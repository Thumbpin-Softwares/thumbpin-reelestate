import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/real-estate-video/continuation
 * Generates the first Veo clip from composite+script, then extends it for each additional segment.
 * Input: FormData
 *  - count: number of segments
 *  - compositeImage_0..N (file)
 *  - script_0..N (string)
 *  - voicePrompt (optional)
 *  - aspectRatio (9:16|16:9) default 9:16
 *  - resolution (720p|1080p) default 720p
 */
export async function POST(request) {
  let userId = null;
  const debits = [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;
    const formData = await request.formData();
    const count = parseInt(formData.get("count")) || 0;
    const voicePromptInput = formData.get("voicePrompt") || "";
    const aspectRatio = formData.get("aspectRatio") || "9:16";
    const resolution = formData.get("resolution") || "720p";

    if (!count || count < 1) {
      return NextResponse.json({ error: "count is required" }, { status: 400 });
    }

    const segments = [];
    for (let i = 0; i < count; i++) {
      const compositeFile = formData.get(`compositeImage_${i}`);
      const script = formData.get(`script_${i}`);
      if (!compositeFile || !script) {
        return NextResponse.json({ error: `Missing compositeImage_${i} or script_${i}` }, { status: 400 });
      }
      segments.push({ compositeFile, script: String(script) });
    }

    const ai = new GoogleGenAI({ apiKey });

    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        data: buffer.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    async function pollOperation(initialOperation) {
      let currentOp = initialOperation;
      const timeout = Date.now() + 12 * 60 * 1000;

      while (currentOp && !currentOp.done) {
        if (Date.now() > timeout) throw new Error("Video generation timed out");
        await new Promise((r) => setTimeout(r, 10000));

        const nextOp = await ai.operations.getVideosOperation({
          operation: currentOp,
        });

        if (!nextOp) {
          console.warn("[RE Continuation] Poll returned null, retrying...");
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

    async function generateWithRetry(payload, maxRetries = 2) {
      let lastErr;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const generationOp = await ai.models.generateVideos(payload);
          if (!generationOp) throw new Error("Failed to start video generation");
          const result = await pollOperation(generationOp);
          return result;
        } catch (err) {
          lastErr = err;
          if (!isTransientError(err) || attempt === maxRetries) throw err;
          const delayMs = 8000 * (attempt + 1);
          console.warn(`[RE Continuation] Transient error, retrying in ${delayMs}ms:`, err.message);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      throw lastErr;
    }

    function buildVideoPrompt(script, voicePrompt) {
      const SKIN_TOKENS = `Photorealistic detail. Real human skin with visible natural texture, pores, and micro shadows. Preserve natural under-eye detail and realistic lip texture. No airbrushing or waxy finish. Authentic facial structure with natural micro-expressions and eye depth. Lighting behaves naturally with soft highlights and realistic shadows. High-detail editorial realism, grounded in real-world 4k camera capture.`;

      return `Ultra-realistic real estate property showcase video in 9:16 portrait format. This should look EXACTLY like a professional real estate influencer's property tour on Instagram Reels or YouTube Shorts. The person (exactly as seen in the reference image) is standing inside the property and presenting it directly to the camera with confident enthusiasm.

PRESENTER ENERGY & BODY LANGUAGE:
- The presenter is CONFIDENT and WARM — like a top real estate creator who genuinely believes this is the perfect property
- Professional warm smile — inviting and trustworthy
- Confident hand gestures — sweeping arm movements to showcase the space, pointing to features, gesturing toward windows/views
- Natural head movements — slight nods of approval, looking around the space then back to camera
- Professional posture — confident stance, slight lean toward camera for intimate moments
- At least ONE moment where they step to the side or gesture widely to reveal more of the space behind them
- ${SKIN_TOKENS}

PROPERTY SHOWCASE MOMENTS:
- The property/space is clearly visible around and behind the presenter throughout
- Natural light from windows enhances the premium feel
- The property should look aspirational, well-lit, and inviting

SPEECH AND AUDIO:
- The person speaks the following script with confident warmth and real estate presenter energy: "${script}"
- VOICE CHARACTERISTICS: ${voicePrompt}
- Delivery should feel professional but genuine — like a trusted advisor showing you your dream home
- Hook delivery should be attention-grabbing — designed to stop the scroll
- Lip movements must be perfectly synchronized with the speech

AUDIO REALISM (CRITICAL — NO ROBOTIC ARTIFACTS):
- Dry close-mic (6 inches) studio-quality capture
- No echo, no reverb, no robotic artifacts
- Warm, natural human breath and sibilance
- Subtle room tone only, no background music or noise
`;
    }

    async function generateVoicePromptInternal(compositeInlineData, script) {
      const prompt = `You are an expert voice casting director for real estate video content.

Look at this image of a person presenting a property. They will speak: "${script}"

Generate a DETAILED voice description. The voice must sound like a CONFIDENT REAL ESTATE PROFESSIONAL — warm, authoritative, aspirational.

Return a single paragraph with ALL attributes comma-separated:
- Gender and age range
- Accent type (specific — e.g., "neutral Indian-English accent")
- Pitch level and variation
- Tone quality (warm, confident, rich, authoritative, inviting)
- Emotional delivery arc: opens with hook energy, transitions to smooth walkthrough, ends aspirational
- Speaking style: confident real estate presenter, NOT stiff
- Vocal expressiveness (dramatic pauses before key features, voice drops for intimate moments)
- Pacing: measured but engaging, ~140 wpm
- RECORDING QUALITY: dry close-mic (6 inches), zero reverb, zero echo, zero robotic artifacts, warm chest resonance, natural sibilance, soft room ambient hum, natural dynamic range

Return ONLY the voice description paragraph. No headers, no explanations.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }, { inlineData: compositeInlineData }] }],
      });

      let vp = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!vp || vp.length < 30) throw new Error("Empty voice prompt");
      return vp.replace(/^["']|["']$/g, "");
    }

    const baseCredit = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/real-estate-video/continuation", segments: count },
    });
    if (!baseCredit.ok) return NextResponse.json(baseCredit.payload, { status: baseCredit.status });
    debits.push({ action: "real_estate_video", debit: baseCredit.debit });

    // Build base reference image
    const baseCompositeData = await fileToBase64(segments[0].compositeFile);
    const referenceImages = [
      {
        image: {
          imageBytes: baseCompositeData.data,
          mimeType: baseCompositeData.mimeType,
        },
        referenceType: "asset",
      },
    ];

    let voicePrompt = voicePromptInput;
    if (!voicePrompt || voicePrompt.trim().length < 20) {
      voicePrompt = await generateVoicePromptInternal(baseCompositeData, segments[0].script);
    }

    const veoPrompt = buildVideoPrompt(segments[0].script, voicePrompt);

    const firstResult = await generateWithRetry({
      model: "veo-3.1-generate-preview",
      prompt: veoPrompt,
      config: {
        aspectRatio,
        durationSeconds: 8,
        resolution,
        referenceImages,
      },
    });

    let currentVideoUri = firstResult.generatedVideos?.[0]?.video?.uri;
    if (!currentVideoUri) throw new Error("Video generation returned no video");

    for (let i = 1; i < segments.length; i++) {
      const extCredit = await consumeCreditsForAction({
        userId,
        action: "real_estate_video_extension",
        metadata: { endpoint: "/api/real-estate-video/continuation", index: i + 1 },
      });
      if (!extCredit.ok) return NextResponse.json(extCredit.payload, { status: extCredit.status });
      debits.push({ action: "real_estate_video_extension", debit: extCredit.debit });

      const continuationPrompt = `Continue the SAME video with the SAME presenter, clothing, face, body, and visual style. Maintain lighting, framing, and camera motion continuity. The presenter remains in the same location context and keeps speaking naturally.\nScript to speak: "${segments[i].script}"\nVoice characteristics (must remain consistent): ${voicePrompt}`;

      const extResult = await generateWithRetry({
        model: "veo-3.1-generate-preview",
        video: { uri: currentVideoUri },
        prompt: continuationPrompt,
        config: { numberOfVideos: 1, aspectRatio, resolution },
      });

      const nextUri = extResult.generatedVideos?.[0]?.video?.uri;
      if (!nextUri) throw new Error("Extension returned no video");
      currentVideoUri = nextUri;
    }

    const uriParts = currentVideoUri.split("/");
    const fileName = uriParts.pop() || "";
    const fileId = fileName.split(":")[0].split("?")[0];
    const proxyUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;

    let localVideoUrl = proxyUrl;
    try {
      const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?key=${apiKey}&alt=media`;
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
      const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

      const key = buildUserKey(userId, "videos", "mp4", "re-continuation");
      localVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
      console.log(`[RE Continuation] Uploaded to R2: ${key} (${(videoBytes.length / 1024 / 1024).toFixed(1)} MB)`);
    } catch (saveErr) {
      console.error("[RE Continuation] R2 upload failed, using proxy URL:", saveErr.message);
    }

    try {
      await dbConnect();
      await Asset.create({
        userId,
        name: `Real Estate Continuation - ${new Date().toLocaleDateString()}`,
        url: localVideoUrl,
        type: "clip",
        metadata: {
          fileId,
          videoUri: currentVideoUri,
          segments: segments.map((s) => ({ script: s.script })),
          source: "veo",
          context: "real-estate-video-continuation",
        },
      });
    } catch (dbErr) {
      console.error("[RE Continuation] DB Error:", dbErr);
    }

    return NextResponse.json({
      success: true,
      videoUrl: localVideoUrl,
      videoUri: currentVideoUri,
      segments: segments.length,
    });
  } catch (error) {
    console.error("[RE Continuation] Error:", error);

    for (const entry of debits.reverse()) {
      try {
        await refundCreditsForAction({
          userId,
          action: entry.action,
          debit: entry.debit,
          metadata: {
            endpoint: "/api/real-estate-video/continuation",
            reason: "unexpected_error",
            message: error.message,
          },
        });
      } catch (refundErr) {
        console.error("[RE Continuation] Refund failed:", refundErr);
      }
    }

    return NextResponse.json({ error: error.message || "Continuation generation failed" }, { status: 500 });
  }
}