import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { resolveUserFromSession } from "@/lib/user-resolver";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/real-estate-video/extend
 * Extend a Veo 3.1 generated video by 7 seconds per segment.
 * Input (JSON):
 *  - baseVideoUri: string (required) — Veo video URI from previous generation
 *  - segments: [{ prompt?: string, script?: string }] (optional)
 *  - prompt: string (optional if segments missing)
 *  - script: string (optional if segments missing)
 *  - voicePrompt: string (optional)
 *  - aspectRatio: "9:16"|"16:9" (default "9:16")
 *  - resolution: "720p"|"1080p" (default "720p")
 * Output: { success, videoUrl, videoUri, steps }
 */
export async function POST(request) {
  let userId = null;
  let debit = null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user._id.toString();
    const body = await request.json();

    const {
      baseVideoUri,
      segments = [],
      prompt,
      script,
      voicePrompt,
      aspectRatio = "9:16",
      resolution = "720p",
      retryAttempts = 1,
    } = body || {};

    if (!baseVideoUri) {
      return NextResponse.json({ error: "baseVideoUri is required" }, { status: 400 });
    }

    const normalizedSegments = segments.length
      ? segments
      : [{ prompt, script }];

    const validSegments = normalizedSegments.filter((s) => s?.prompt || s?.script);
    if (!validSegments.length) {
      return NextResponse.json({ error: "At least one prompt or script is required" }, { status: 400 });
    }

    if (validSegments.length > 20) {
      return NextResponse.json({ error: "Maximum 20 extension segments allowed" }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video_extension",
      metadata: {
        endpoint: "/api/real-estate-video/extend",
        segments: validSegments.length,
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const ai = new GoogleGenAI({ apiKey });

    async function pollOperation(initialOperation) {
      let currentOp = initialOperation;
      const timeout = Date.now() + 12 * 60 * 1000;

      while (currentOp && !currentOp.done) {
        if (Date.now() > timeout) throw new Error("Video extension timed out");
        await new Promise((r) => setTimeout(r, 10000));

        const nextOp = await ai.operations.getVideosOperation({
          operation: currentOp,
        });

        if (!nextOp) {
          console.warn("[RealEstateExtend] Poll returned null, retrying...");
          continue;
        }
        currentOp = nextOp;
      }

      if (!currentOp) throw new Error("Operation lost during polling");

      if (currentOp.error) {
        const msg = currentOp.error.message || "";
        if (msg.includes("internal server issue")) {
          throw new Error("Gemini encountered a transient internal error. Please try again in 1-2 minutes.");
        }
        throw new Error(msg || "Operation failed");
      }
      return currentOp.response;
    }

    function isTransientError(err) {
      const msg = (err?.message || "").toLowerCase();
      return (
        msg.includes("internal server issue") ||
        msg.includes("transient") ||
        msg.includes("temporarily") ||
        msg.includes("timeout") ||
        msg.includes("429") ||
        msg.includes("503")
      );
    }

    function extractFileIdFromUri(uri) {
      if (!uri || typeof uri !== "string") return null;
      const match = uri.match(/files\/([^/?]+)/);
      if (match?.[1]) return match[1];
      const last = uri.split("/").pop() || "";
      return last.split(":")[0].split("?")[0];
    }

    async function generateWithRetry(payload, maxRetries = 2) {
      let lastErr;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const generationOp = await ai.models.generateVideos(payload);
          if (!generationOp) throw new Error("Failed to start video extension");
          const result = await pollOperation(generationOp);
          return result;
        } catch (err) {
          lastErr = err;
          if (!isTransientError(err) || attempt === maxRetries) throw err;
          const delayMs = 8000 * (attempt + 1);
          console.warn(`[RealEstateExtend] Transient error, retrying in ${delayMs}ms:`, err.message);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      throw lastErr;
    }

    function buildContinuationPrompt(segment) {
      const segmentScript = segment.script ? `\nScript to speak: "${segment.script}"` : "";
      const segmentPrompt = segment.prompt ? `\nScene details: ${segment.prompt}` : "";
      const voiceLine = voicePrompt
        ? `\nVoice characteristics (must remain consistent): ${voicePrompt}`
        : "\nKeep the same voice characteristics as the original video.";

      return `Continue the SAME video with the SAME presenter, clothing, face, body, and visual style. Maintain lighting, framing, and camera motion continuity. The presenter remains in the same location context and keeps speaking naturally.
${segmentPrompt}${segmentScript}
${voiceLine}
Ensure lips stay perfectly synced to the spoken script and motion remains smooth.`;
    }

    let currentVideoUri = baseVideoUri;
    const steps = [];

    for (let i = 0; i < validSegments.length; i++) {
      const segment = validSegments[i];
      const continuationPrompt = buildContinuationPrompt(segment);

      try {
        const result = await generateWithRetry({
          model: "veo-3.1-generate-preview",
          video: { uri: currentVideoUri },
          prompt: continuationPrompt,
          config: {
            numberOfVideos: 1,
            aspectRatio,
            resolution,
          },
        }, Math.min(Math.max(parseInt(retryAttempts) || 1, 0), 3));
        const generatedVideo = result.generatedVideos?.[0]?.video;
        if (!generatedVideo?.uri) throw new Error("Extension returned no video");

        currentVideoUri = generatedVideo.uri;
        steps.push({
          index: i + 1,
          videoUri: generatedVideo.uri,
        });
      } catch (err) {
        return NextResponse.json(
          {
            error: err.message || "Extension failed",
            failedIndex: i,
            lastVideoUri: currentVideoUri,
            remainingSegments: validSegments.slice(i),
          },
          { status: 502 }
        );
      }
    }

    const fileId = extractFileIdFromUri(currentVideoUri);
    if (!fileId) throw new Error("Failed to extract fileId from video URI");
    const proxyUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;

    // Upload video to R2
    let localVideoUrl = proxyUrl;
    try {
      const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?key=${apiKey}&alt=media`;
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
      const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

      const key = buildUserKey(userId, "videos", "mp4", "re-extended");
      localVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
      console.log(`[RealEstateExtend] Uploaded to R2: ${key} (${(videoBytes.length / 1024 / 1024).toFixed(1)} MB)`);
    } catch (saveErr) {
      console.error("[RealEstateExtend] R2 upload failed, using proxy URL:", saveErr.message);
    }

    try {
      await dbConnect();
      await Asset.create({
        userId,
        name: `Real Estate Extended Video - ${new Date().toLocaleDateString()}`,
        url: localVideoUrl,
        type: "clip",
        metadata: {
          fileId,
          videoUri: currentVideoUri,
          baseVideoUri,
          segments: validSegments,
          source: "veo",
          context: "real-estate-video-extension",
        },
      });
    } catch (dbErr) {
      console.error("[RealEstateExtend] DB Error:", dbErr);
    }

    return NextResponse.json({
      success: true,
      videoUrl: localVideoUrl,
      videoUri: currentVideoUri,
      steps,
    });
  } catch (error) {
    console.error("[RealEstateExtend] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video_extension",
        debit,
        metadata: {
          endpoint: "/api/real-estate-video/extend",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json({ error: error.message || "Video extension failed" }, { status: 500 });
  }
}