import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/product-video/generate
 * Generate the final product video using Veo 3.1 with SSE streaming.
 * Input: FormData with compositeImage (file) + script (string) + voicePrompt (string)
 * Output: SSE stream with progress, video_ready, done events
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

    const formData = await request.formData();
    const compositeFile = formData.get("compositeImage");
    const script = formData.get("script");
    const voicePrompt = formData.get("voicePrompt");

    if (!compositeFile || !script || !voicePrompt) {
      return NextResponse.json(
        { error: "compositeImage, script, and voicePrompt are required" },
        { status: 400 }
      );
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "product_video",
      metadata: {
        endpoint: "/api/product-video/generate",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    // Convert composite image to base64
    const arrayBuffer = await compositeFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const compositeBase64 = {
      imageBytes: buffer.toString("base64"),
      mimeType: compositeFile.type || "image/jpeg",
    };

    const referenceImages = [
      {
        image: compositeBase64,
        referenceType: "asset",
      },
    ];

    // Build the Veo prompt
    const veoPrompt = buildVideoPrompt(script, voicePrompt);

    // SSE stream setup
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        async function pollOperation(initialOperation) {
          let currentOp = initialOperation;
          const timeout = Date.now() + 10 * 60 * 1000; // 10 min timeout

          while (currentOp && !currentOp.done) {
            if (Date.now() > timeout) throw new Error("Video generation timed out");

            await new Promise((r) => setTimeout(r, 10000)); // Poll every 10s

            const nextOp = await ai.operations.getVideosOperation({
              operation: currentOp,
            });

            if (!nextOp) {
              console.warn("[ProductVideo] Poll returned null, retrying...");
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

        try {
          send({
            type: "progress",
            videoIndex: 0,
            status: "generating",
            message: "🎬 Generating your product video with Veo 3.1...",
          });

          const generationOp = await ai.models.generateVideos({
            model: "veo-3.1-generate-preview",
            prompt: veoPrompt,
            config: {
              aspectRatio: "9:16",
              durationSeconds: 8,
              resolution: "720p",
              referenceImages,
            },
          });

          if (!generationOp) {
            throw new Error("Failed to start video generation");
          }

          send({
            type: "progress",
            videoIndex: 0,
            status: "generating",
            message: "⏳ Video is being rendered... this usually takes 1-3 minutes.",
          });

          // Poll until done
          const result = await pollOperation(generationOp);

          const generatedVideo = result.generatedVideos?.[0]?.video;
          if (!generatedVideo) throw new Error("Video generation returned no video");

          // Extract fileId from URI
          const uriParts = generatedVideo.uri.split("/");
          const fileName = uriParts.pop() || "";
          const fileId = fileName.split(":")[0].split("?")[0];
          const proxyUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;

          // ── Upload video to R2 ────────────────────────────────────────────
          let localVideoUrl = proxyUrl;
          try {
            send({
              type: "progress",
              videoIndex: 0,
              status: "saving",
              message: "☁️ Saving video to cloud storage...",
            });

            // Download the video bytes from Gemini
            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?key=${apiKey}&alt=media`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const key = buildUserKey(userId, "videos", "mp4", "product");
            localVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
            console.log(`[ProductVideo] Uploaded to R2: ${key} (${(videoBytes.length / 1024 / 1024).toFixed(1)} MB)`);
          } catch (saveErr) {
            console.error("[ProductVideo] R2 upload failed, using proxy URL:", saveErr.message);
          }

          send({
            type: "video_ready",
            videoIndex: 0,
            videoUrl: localVideoUrl,
            isLast: true,
          });

          // Save to Asset Library
          try {
            await dbConnect();
            await Asset.create({
              userId,
              name: `Product Video - ${new Date().toLocaleDateString()}`,
              url: localVideoUrl,
              type: "clip",
              metadata: {
                fileId,
                source: "veo",
                context: "product-video",
              },
            });
            console.log("[ProductVideo] Created asset for video:", fileId);
          } catch (dbErr) {
            console.error("[ProductVideo] DB Error:", dbErr);
          }

          send({ type: "done", totalVideos: 1 });
          controller.close();
        } catch (err) {
          console.error("[ProductVideo] Generation error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "product_video",
              debit,
              metadata: {
                endpoint: "/api/product-video/generate",
                reason: "generation_failed",
                message: err.message,
              },
            });
          }

          send({ type: "error", message: err.message || "Video generation failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[ProductVideo] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "product_video",
        debit,
        metadata: {
          endpoint: "/api/product-video/generate",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to start generation" },
      { status: 500 }
    );
  }
}

/**
 * Build a cinematic Veo prompt from the script, voice prompt, and composite image.
 */
function buildVideoPrompt(script, voicePrompt) {
  const SKIN_TOKENS = `Photorealistic detail. Real human skin with visible natural texture, pores, and micro shadows. Preserve natural under-eye detail and realistic lip texture. No airbrushing or waxy finish. Authentic facial structure with natural micro-expressions and eye depth. Lighting behaves naturally with soft highlights and realistic shadows. High-detail editorial realism, grounded in real-world 4k camera capture.`;

  return `Ultra-realistic UGC (User Generated Content) product showcase video in 9:16 portrait format. This should look EXACTLY like a real person filming themselves on their phone for Instagram Reels or TikTok — NOT a corporate ad. The person (exactly as seen in the reference image) is holding the product and speaking directly to the camera with genuine excitement.

CREATOR ENERGY & BODY LANGUAGE:
- The creator is EXPRESSIVE and ANIMATED — like a real UGC creator who genuinely loves this product
- Big, natural smile that reaches their eyes — the kind of smile when you're showing your best friend something cool
- Eyebrows raise with excitement when describing key features
- Head tilts, nods, and natural "you know what I mean?" head movements
- They lean slightly toward the camera at key moments for emphasis (like sharing a secret)
- Free hand gestures — pointing at the product, counting features on fingers, "chef's kiss" or "mind blown" energy
- Natural weight shifting and slight upper body sway — NOT standing stiff like a mannequin
- Occasional glances down at the product then back to camera with a "look at this!" expression
- ${SKIN_TOKENS}

PRODUCT SHOWCASE MOMENTS:
- Opens by holding the product up near their face with excitement
- At least ONE clear "hero moment" — they hold the product straight to camera, angling it to show it off
- Natural product interactions: turning it, tapping it, gesturing toward specific features
- The product is well-lit, sharp, and the center of attention during showcase moments
- When mentioning a feature, they naturally point to or touch that part of the product

SPEECH AND AUDIO:
- The person speaks the following script with genuine enthusiasm and natural conversational energy: "${script}"
- VOICE CHARACTERISTICS: ${voicePrompt}
- Delivery should feel like they're FaceTiming a friend, NOT reading a script
- Natural vocal variation — excitement peaks, casual drops, emphasis on key words
- Lip movements must be perfectly synchronized with the speech
- Quick natural breaths between phrases, not robotic pauses
- The occasional natural "filler" energy (slight pause before a reveal, a quick inhale of excitement)

AUDIO REALISM (CRITICAL — NO ROBOTIC ARTIFACTS):
- Voice must sound like a REAL human recording on a quality lavalier or smartphone mic — warm, present, intimate
- ZERO robotic artifacts: no metallic overtones, no synthetic buzz, no digital clipping, no unnatural pitch smoothing
- ZERO echo or reverb — dry, close-mic recording feel as if the mic is 6 inches from their mouth
- Natural room tone: very subtle ambient hum of a quiet room, NOT dead digital silence (dead silence sounds artificial)
- Slight natural sibilance on 's' and 'sh' sounds (real mics capture this)
- Micro lip-smack sounds between sentences are WELCOME — they make it feel real
- Breath noise should be present but not exaggerated — the way a real close-mic captures soft inhales
- Voice should have natural chest resonance and body — not thin or tinny
- Audio dynamics should be natural: louder words when excited, softer words when being conspiratorial — NOT compressed flat

VISUAL STYLE:
- Shot on a high-quality smartphone in selfie mode — casual but crisp
- Warm, natural indoor lighting (golden hour window light or soft ring light)
- Shallow depth of field with slightly blurred cozy background (bedroom, kitchen, living room vibes)
- Subtle natural camera micro-movements (handheld feel, not tripod-locked)
- Color grading: warm, inviting, slightly boosted saturation — Instagram-ready

CRITICAL: The person, their clothing, the product, and the setting must exactly match the reference image. No changes to appearance. High-quality synchronized audio throughout. This must look and SOUND like a REAL person made this video, not AI. The audio quality is as important as the visual quality.`;
}
