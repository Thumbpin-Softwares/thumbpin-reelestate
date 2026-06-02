import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/veo-long-ad/generate-pipeline
 *
 * Core SSE pipeline:
 * 1. Generate first 8s clip (Veo 3.1 generateVideos with reference images)
 * 2. For each subsequent chunk, extend using Veo 3.1 extend (video: { uri })
 * 3. Return final extended video URL
 *
 * Input (FormData):
 * chunks: JSON string (array of chunk objects from /chunk-script)
 * masterVoicePrompt: string
 * locationImages[]: File[]
 * avatarImages[]: File[]
 * language: string
 * aspectRatio: "9:16" | "16:9"
 *
 * SSE events:
 * { type: "progress", chunkIndex, totalChunks, status, message }
 * { type: "chunk_done", chunkIndex, totalChunks, estimatedDuration }
 * { type: "uploading", message }
 * { type: "video_ready", videoUrl, totalChunks, totalDuration }
 * { type: "error", message, failedChunkIndex? }
 * { type: "done" }
 */
export async function POST(request) {
  let userId = null;
  let debit = null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    userId = user._id.toString();

    const formData = await request.formData();

    // Parse chunks JSON
    const chunksRaw = formData.get("chunks");
    if (!chunksRaw) {
      return NextResponse.json({ error: "chunks is required" }, { status: 400 });
    }
    let chunks;
    try {
      chunks = JSON.parse(chunksRaw);
    } catch {
      return NextResponse.json({ error: "Invalid chunks JSON" }, { status: 400 });
    }
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json({ error: "At least 1 chunk required" }, { status: 400 });
    }
    if (chunks.length > 10) {
      return NextResponse.json({ error: "Maximum 10 chunks allowed" }, { status: 400 });
    }

    const masterVoicePrompt = (formData.get("masterVoicePrompt") || "").toString();
    const presenterDescription = (formData.get("presenterDescription") || "").toString();
    const language = (formData.get("language") || "english").toString();
    const aspectRatio = (formData.get("aspectRatio") || "9:16").toString();

    // Collect location images (for first video reference)
    const locationImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`locationImage_${i}`);
      if (file) locationImages.push(file);
    }
    if (locationImages.length === 0) {
      const single = formData.get("locationImage");
      if (single) locationImages.push(single);
    }

    // Collect avatar images
    const avatarImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`avatarImage_${i}`);
      if (file) avatarImages.push(file);
    }
    if (avatarImages.length === 0) {
      const single = formData.get("avatarImage");
      if (single) avatarImages.push(single);
    }

    // Debit credits (for first generation)
    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/veo-long-ad/generate-pipeline" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    // Build reference images for first clip
    async function fileToBase64(file) {
      const buf = Buffer.from(await file.arrayBuffer());
      return {
        imageBytes: buf.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const avatarImgs = [];
    for (const f of avatarImages.slice(0, 2)) {
      try {
        avatarImgs.push(await fileToBase64(f));
      } catch (_) {}
    }

    const locationImgs = [];
    for (const f of locationImages.slice(0, 2)) {
      try {
        locationImgs.push(await fileToBase64(f));
      } catch (_) {}
    }

    const maxSlots = 3;
    const avatarSlots = Math.min(avatarImgs.length, maxSlots - 1);
    const locationSlots = Math.min(locationImgs.length, maxSlots - avatarSlots);
    console.log(`[VeoLongAd] avatarSlots: ${avatarSlots}, locationSlots: ${locationSlots}`);

    const referenceImages = [
      ...avatarImgs.slice(0, avatarSlots).map((img) => ({
        image: img,
        referenceType: "SUBJECT", // 🎯 Tells Veo this is the primary human character
      })),
      ...locationImgs.slice(0, locationSlots).map((img) => ({
        image: img,
        referenceType: "STYLE", // 🎯 Tells Veo this is the background environment/style
      })),
    ];
    console.log(`[VeoLongAd] Total referenceImages: ${referenceImages.length}`);

    // ── SSE stream ────────────────────────────────────────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (_) {}
        }

        async function pollOperation(initialOperation, timeoutMs = 12 * 60 * 1000) {
          let currentOp = initialOperation;
          const deadline = Date.now() + timeoutMs;

          while (currentOp && !currentOp.done) {
            if (Date.now() > deadline) throw new Error("Video generation timed out");
            await new Promise((r) => setTimeout(r, 10000));

            const nextOp = await ai.operations.getVideosOperation({ operation: currentOp });
            if (!nextOp) {
              console.warn("[VeoLongAd] Poll returned null, retrying...");
              continue;
            }
            currentOp = nextOp;
          }

          if (!currentOp) throw new Error("Operation lost during polling");
          if (currentOp.error) {
            const msg = currentOp.error.message || "";
            throw new Error(msg.includes("internal server issue")
              ? "Gemini encountered a transient error. Please retry in 1–2 minutes."
              : msg || "Operation failed");
          }

          console.log("[VeoLongAd] Operation done. Top-level keys:", currentOp ? Object.keys(currentOp) : "null");
          const resp = currentOp.response ?? currentOp;
          console.log("[VeoLongAd] Response keys:", resp ? Object.keys(resp) : "null");
          try {
            console.log("[VeoLongAd] Response (truncated):", JSON.stringify(resp)?.slice(0, 600));
          } catch (_) {}

          return resp;
        }

        function extractGeneratedVideo(result) {
          if (!result) return null;

          // Direct generatedVideos array (most common SDK shape)
          const v0 =
            result?.generatedVideos?.[0]?.video ||
            result?.generatedVideos?.[0]?.videoResponse;
          if (v0) return v0;

          // Nested under response (operation wrapper shape)
          const v1 =
            result?.response?.generatedVideos?.[0]?.video ||
            result?.response?.generatedVideos?.[0]?.videoResponse;
          if (v1) return v1;

          // generateVideoResponse.generatedSamples (proto REST shape)
          const v2 =
            result?.generateVideoResponse?.generatedSamples?.[0]?.video ||
            result?.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
          if (v2) return v2;

          // videos[] top-level (some SDK versions)
          const v3 = result?.videos?.[0];
          if (v3) return v3;

          // Multimodal candidates fallback
          const v4 = result?.candidates?.[0]?.content?.parts?.find((p) => p?.fileData?.fileUri)?.fileData;
          if (v4) return v4;

          console.warn("[VeoLongAd] extractGeneratedVideo: no video found. result keys:", Object.keys(result));
          return null;
        }

        function extractVideoUri(videoObj) {
          if (!videoObj) return null;
          return videoObj.uri || videoObj.fileUri || videoObj.videoUri || videoObj.url || null;
        }

        function extractFileId(uri) {
          if (!uri) return null;
          const match = uri.match(/files\/([^/:?]+)/);
          return match?.[1] || null;
        }

        /**
         * Strip :download?alt=media (and any query params) from the Veo URI.
         */
        function cleanVeoUri(uri) {
          if (!uri) return uri;
          return uri.replace(/:download.*$/, "").replace(/\?.*$/, "");
        }

        let currentVideoUri = null;
        const totalChunks = chunks.length;

        try {
          // ── Step 1: Generate first 8-second clip ─────────────────────────
          const chunk0 = chunks[0];

          send({
            type: "progress",
            chunkIndex: 0,
            totalChunks,
            status: "generating",
            message: `🎬 Generating base clip (1/${totalChunks}) — this takes 2–3 minutes...`,
          });

          const firstPrompt = buildFirstClipPrompt(chunk0, masterVoicePrompt, language);

          const genOp = await ai.models.generateVideos({
            model: "veo-3.1-generate-preview",
            prompt: firstPrompt,
            config: {
              aspectRatio,
              resolution: "720p",
              durationSeconds: 8,
              referenceImages,
            },
          });

          if (!genOp) throw new Error("Failed to start base video generation");

          console.log("[VeoLongAd] genOp keys:", genOp ? Object.keys(genOp) : null);

          send({
            type: "progress",
            chunkIndex: 0,
            totalChunks,
            status: "rendering",
            message: "⏳ Rendering base clip... usually takes 2–3 minutes.",
          });

          const firstResult = await pollOperation(genOp);
          const firstGeneratedVideo = extractGeneratedVideo(firstResult);
          const rawVideoUri = extractVideoUri(firstGeneratedVideo);

          if (!rawVideoUri) {
            throw new Error("Base video generation returned no video. The prompt may have been rejected or Veo returned an unexpected response shape.");
          }
          currentVideoUri = cleanVeoUri(rawVideoUri);
          console.log("[VeoLongAd] Base clip URI (clean for extension):", currentVideoUri);

          const baseClipFileId = extractFileId(currentVideoUri);
          send({
            type: "chunk_done",
            chunkIndex: 0,
            totalChunks,
            estimatedDuration: chunk0.estimatedSeconds || 8,
            clipUrl: baseClipFileId ? `/api/ai-walkthrough/video-proxy?fileId=${baseClipFileId}` : null,
            message: `✅ Base clip ready (${chunk0.estimatedSeconds || 8}s)`,
          });

          // ── Step 2: Extend for each subsequent chunk ──────────────────────
          let cumulativeDuration = chunk0.estimatedSeconds || 8;

          if (chunks.length > 1) {
            send({
              type: "progress",
              chunkIndex: 0,
              totalChunks,
              status: "extending",
              message: "⏳ Waiting for base clip to be indexed by Veo (15s)...",
            });
            await new Promise((r) => setTimeout(r, 15000));
          }

          for (let i = 1; i < chunks.length; i++) {
            const chunk = chunks[i];

            send({
              type: "progress",
              chunkIndex: i,
              totalChunks,
              status: "extending",
              message: `🔄 Extending with chunk ${i + 1}/${totalChunks} (~${cumulativeDuration}s so far)...`,
            });

            const extensionPrompt = buildExtensionPrompt(chunk, masterVoicePrompt, language, presenterDescription);

            let extVideoUri = null;
            let lastErr;

            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const extOp = await ai.models.generateVideos({
                  model: "veo-3.1-generate-preview",
                  video: { uri: currentVideoUri },
                  prompt: extensionPrompt,
                  config: {
                    aspectRatio,
                    resolution: "720p",
                  },
                });

                if (!extOp) throw new Error("Failed to start extension operation");

                send({
                  type: "progress",
                  chunkIndex: i,
                  totalChunks,
                  status: "extending",
                  message: `⏳ Rendering extension ${i + 1}/${totalChunks}...`,
                });

                const extResult = await pollOperation(extOp);
                const extVideo = extractGeneratedVideo(extResult);
                const rawExtUri = extractVideoUri(extVideo);
                extVideoUri = cleanVeoUri(rawExtUri);

                if (!extVideoUri) {
                  throw new Error(`Extension chunk ${i + 1} returned no video URI`);
                }

                break; // success
              } catch (err) {
                lastErr = err;
                const msg = (err.message || "").toLowerCase();
                const isTransient =
                  msg.includes("internal server") ||
                  msg.includes("transient") ||
                  msg.includes("timeout") ||
                  msg.includes("429") ||
                  msg.includes("503") ||
                  msg.includes("not processed") ||
                  msg.includes("invalid_argument");

                if (!isTransient || attempt === 2) throw err;

                const delay = msg.includes("not processed") || msg.includes("invalid_argument")
                  ? 30000 * (attempt + 1)
                  : 8000 * (attempt + 1);

                send({
                  type: "progress",
                  chunkIndex: i,
                  totalChunks,
                  status: "extending",
                  message: `⚠️ Temporary error, retrying chunk ${i + 1} in ${delay / 1000}s...`,
                });
                await new Promise((r) => setTimeout(r, delay));
              }
            }

            if (!extVideoUri) {
              send({
                type: "error",
                failedChunkIndex: i,
                message: `Extension stopped at chunk ${i + 1}: ${lastErr?.message || "No video returned"}. Saving partial video (${cumulativeDuration}s).`,
                partial: true,
              });
              break;
            }

            currentVideoUri = extVideoUri;
            cumulativeDuration += chunk.estimatedSeconds || 8;

            const extClipFileId = extractFileId(extVideoUri);
            send({
              type: "chunk_done",
              chunkIndex: i,
              totalChunks,
              estimatedDuration: cumulativeDuration,
              clipUrl: extClipFileId ? `/api/ai-walkthrough/video-proxy?fileId=${extClipFileId}` : null,
              message: `✅ Extended to ~${cumulativeDuration}s (chunk ${i + 1}/${totalChunks} done)`,
            });
          }

          // ── Step 3: Download + upload to R2 ──────────────────────────────
          const finalFileId = extractFileId(currentVideoUri);
          if (!finalFileId) throw new Error("Failed to extract final fileId");

          send({
            type: "uploading",
            message: "☁️ Saving final video to cloud storage...",
          });

          let finalVideoUrl = `/api/ai-walkthrough/video-proxy?fileId=${finalFileId}`;

          try {
            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${finalFileId}?key=${apiKey}&alt=media`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const key = buildUserKey(userId, "videos", "mp4", "veo-long-ad");
            finalVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
          } catch (saveErr) {
            console.error("[VeoLongAd] R2 upload failed, using proxy URL:", saveErr.message);
          }

          // ── Save to Asset Library ─────────────────────────────────────────
          try {
            await dbConnect();
            await Asset.create({
              userId,
              name: `Long-Form Ad — ${new Date().toLocaleDateString()}`,
              url: finalVideoUrl,
              type: "clip",
              metadata: {
                fileId: finalFileId,
                videoUri: currentVideoUri,
                source: "veo-long-ad",
                totalChunks,
                totalDuration: chunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0),
                context: "veo-long-ad",
              },
            });
          } catch (dbErr) {
            console.error("[VeoLongAd] DB save error:", dbErr);
          }

          const totalDuration = chunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0);

          send({
            type: "video_ready",
            videoUrl: finalVideoUrl,
            totalChunks,
            totalDuration,
            message: `🎉 Your ${totalDuration}s long-form ad is ready!`,
          });

          send({ type: "done" });
          controller.close();
        } catch (err) {
          console.error("[VeoLongAd] Pipeline error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: {
                endpoint: "/api/veo-long-ad/generate-pipeline",
                reason: "generation_failed",
                message: err.message,
              },
            });
          }

          send({ type: "error", message: err.message || "Pipeline failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[VeoLongAd] Outer error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: {
          endpoint: "/api/veo-long-ad/generate-pipeline",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to start pipeline" },
      { status: 500 }
    );
  }
}

/**
 * Highly realistic aesthetic instructions.
 */
const REALISM_AESTHETICS = `REALISTIC PROFESSIONAL REAL ESTATE SHOOT: This should look like a high-quality, real-life property tour. Avoid overly glossy or fake "studio" lighting. Use natural daylight and realistic shadows. The footage should feel 100% authentic, with a slight touch of natural imperfection (like a subtle natural breeze or slight handheld realism) to make it feel genuinely real rather than CGI.`;

const LANG_MAP = {
  english:   "Indian-English accent — clear, confident, with natural Indian intonation. NOT a Western or neutral accent.",
  hindi:     "fluent native Hindi — authentic Indian phonetics throughout. Words like 'Gurugram', 'naya', 'ghar', 'sapna' must use proper Hindi pronunciation, not Anglicized. Sounds like a native Hindi speaker from North India.",
  hinglish:  "natural Hinglish — a native Indian speaker seamlessly mixing Hindi and English. Hindi words use authentic Hindi phonetics (e.g. 'Gurugram' not 'Goo-roo-gram', 'naya' not 'nigh-ya'). English words use Indian-English pronunciation. NOT a foreign or Anglicized accent on Hindi words.",
  marathi:   "fluent native Marathi — authentic Marathi phonetics. Sounds like a native Marathi speaker from Maharashtra.",
  tamil:     "fluent native Tamil — authentic Tamil phonetics and intonation. NOT Anglicized Tamil words.",
  telugu:    "fluent native Telugu — authentic Telugu phonetics. Sounds like a native Telugu speaker.",
  kannada:   "fluent native Kannada — authentic Kannada phonetics and intonation.",
  malayalam: "fluent native Malayalam — authentic Kerala pronunciation and intonation.",
  bengali:   "fluent native Bengali — authentic Bengali phonetics. Sounds like a native speaker from West Bengal.",
  gujarati:  "fluent native Gujarati — authentic Gujarati phonetics and intonation.",
  punjabi:   "fluent native Punjabi — authentic Punjabi phonetics. Sounds like a native speaker from Punjab.",
  urdu:      "fluent native Urdu — authentic Urdu phonetics with natural Nastaliq intonation.",
  odia:      "fluent native Odia — authentic Odia phonetics and intonation.",
};

/**
 * Build the prompt for the FIRST Veo clip.
 */
function buildFirstClipPrompt(chunk, masterVoicePrompt, language) {
  const langLabel = LANG_MAP[language] || "Indian-English";

  return `Realistic real estate video ad in 9:16 portrait format. Natural daylight, lifelike textures, and authentic environment styling.

${REALISM_AESTHETICS}

SCENE:
${chunk.veoPrompt || "Smooth, professional establishing shot of the presenter at the property exterior."}

PRESENTER IDENTITY:
• CRITICAL: Match the provided SUBJECT reference image EXACTLY (gender, age, face, hair, body, clothing). Ignore any conflicting terms in the prompt.
• The presenter is speaking naturally to the camera with lifelike, relaxed expressions and body language.

ENVIRONMENT:
• Strictly match the architectural style of the STYLE reference images.
• Keep lighting natural and realistic.

VOICE & LIP-SYNC:
• Voice: ${masterVoicePrompt || "Natural, clear, authoritative Indian real estate presenter. Confident native Indian accent. No background music."}
• Speaking language: ${langLabel}
• EXACT LIP-SYNC: The presenter's lip movements must perfectly sync to: "${chunk.text}".
• PRONUNCIATION: All words must be pronounced exactly as a native Indian speaker would say them — no foreign, Western, or Anglicized accent on any word.

CAMERA ACTION:
• ${chunk.cameraDirection || "Smooth tracking shot introducing the presenter."}

RULES: ONLY exterior shots. NO text, NO watermarks on screen.`;
}

/**
 * Build the EXTENSION prompt — keep it short so Veo continues rather than re-interprets.
 */
function buildExtensionPrompt(chunk, masterVoicePrompt, language, presenterDescription) {
  const langLabel = LANG_MAP[language] || "Indian-English";

  const presenterLine = presenterDescription
    ? `Same presenter as previous frame: ${presenterDescription}. Do not change their face, hair, skin tone, or outfit.`
    : "Continue with the exact same presenter from the previous frame — no appearance changes.";

  return [
    `Continue the real estate video. Same presenter, same property, same natural lighting — seamless continuity from the last frame.`,
    presenterLine,
    `DIALOGUE: "${chunk.text}"`,
    `LANGUAGE: ${langLabel} — lip-sync precisely to the dialogue above. All words pronounced as a native Indian speaker — no Anglicized or foreign accent.`,
    `CAMERA: ${chunk.cameraDirection || "Medium shot, natural handheld feel, slight organic movement."}`,
    `VOICE: ${masterVoicePrompt || "Match the previous clip's voice exactly — same gender, same native Indian accent, same tone and recording quality."}`,
    chunk.veoPrompt ? `SCENE: ${chunk.veoPrompt}` : "",
    `FORMAT: 9:16 vertical. Exterior only. No text, no subtitles, no watermarks.`,
  ].filter(Boolean).join("\n\n");
}

