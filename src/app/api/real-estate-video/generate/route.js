import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/real-estate-video/generate
 * Full pipeline: composite + script → (internal voice prompt) → Veo 3.1 video
 * Input: FormData with compositeImage (file) + script (string)
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
    // Voice prompt is now optional — generated internally if not provided
    let voicePrompt = formData.get("voicePrompt") || "";

    if (!compositeFile || !script) {
      return NextResponse.json(
        { error: "compositeImage and script are required" },
        { status: 400 }
      );
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: {
        endpoint: "/api/real-estate-video/generate",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const arrayBuffer = await compositeFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const compositeBase64 = {
      imageBytes: buffer.toString("base64"),
      mimeType: compositeFile.type || "image/jpeg",
    };
    const compositeInlineData = {
      data: buffer.toString("base64"),
      mimeType: compositeFile.type || "image/jpeg",
    };

    const referenceImages = [
      {
        image: compositeBase64,
        referenceType: "asset",
      },
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        async function pollOperation(initialOperation) {
          let currentOp = initialOperation;
          const timeout = Date.now() + 10 * 60 * 1000;

          while (currentOp && !currentOp.done) {
            if (Date.now() > timeout) throw new Error("Video generation timed out");
            await new Promise((r) => setTimeout(r, 10000));

            const nextOp = await ai.operations.getVideosOperation({
              operation: currentOp,
            });

            if (!nextOp) {
              console.warn("[RealEstateVideo] Poll returned null, retrying...");
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
          // ── Step 1: Generate voice prompt internally if not provided ────
          if (!voicePrompt || voicePrompt.trim().length < 20) {
            send({
              type: "progress",
              videoIndex: 0,
              status: "voice",
              message: "🎙️ Crafting the perfect voice for your presenter...",
            });

            try {
              voicePrompt = await generateVoicePromptInternal(ai, compositeInlineData, script);
              console.log("[RealEstateVideo] Voice prompt generated internally");
            } catch (vpErr) {
              console.error("[RealEstateVideo] Voice prompt gen failed, using default:", vpErr.message);
              voicePrompt = getDefaultVoicePrompt();
            }
          }

          // ── Step 2: Generate video with Veo 3.1 ────────────────────────
          send({
            type: "progress",
            videoIndex: 0,
            status: "generating",
            message: "🏠 Generating your property video with Veo 3.1...",
          });

          const veoPrompt = buildVideoPrompt(script, voicePrompt);

          const generationOp = await ai.models.generateVideos({
            model: "veo-3.1-generate-preview",
            prompt: veoPrompt,
            config: {
              aspectRatio: "9:16",
              durationSeconds: 8,
              resolution: "720p",
              personGeneration: "allow_adult",
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

          const result = await pollOperation(generationOp);

          const generatedVideo = result.generatedVideos?.[0]?.video;
          if (!generatedVideo) throw new Error("Video generation returned no video");

          const uriParts = generatedVideo.uri.split("/");
          const fileName = uriParts.pop() || "";
          const fileId = fileName.split(":")[0].split("?")[0];
          const proxyUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;

          // ── Save video locally ──────────────────────────────────────────
          let localVideoUrl = proxyUrl;
          try {
            send({
              type: "progress",
              videoIndex: 0,
              status: "saving",
              message: "💾 Saving video locally...",
            });

            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?key=${apiKey}&alt=media`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const timestamp = Date.now();
            const localFileName = `real-estate-video-${timestamp}.mp4`;
            const outputDir = path.join(process.cwd(), "public", "generated-videos");
            await mkdir(outputDir, { recursive: true });
            const outputPath = path.join(outputDir, localFileName);
            await writeFile(outputPath, videoBytes);

            localVideoUrl = `/generated-videos/${localFileName}`;
            console.log(`[RealEstateVideo] Video saved locally: ${outputPath} (${(videoBytes.length / 1024 / 1024).toFixed(1)} MB)`);
          } catch (saveErr) {
            console.error("[RealEstateVideo] Local save failed, using proxy URL:", saveErr.message);
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
              name: `Real Estate Video - ${new Date().toLocaleDateString()}`,
              url: localVideoUrl,
              type: "clip",
              metadata: {
                fileId,
                localPath: localVideoUrl,
                source: "veo",
                context: "real-estate-video",
              },
            });
            console.log("[RealEstateVideo] Created asset for video:", fileId);
          } catch (dbErr) {
            console.error("[RealEstateVideo] DB Error:", dbErr);
          }

          send({ type: "done", totalVideos: 1 });
          controller.close();
        } catch (err) {
          console.error("[RealEstateVideo] Generation error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: {
                endpoint: "/api/real-estate-video/generate",
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
    console.error("[RealEstateVideo] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: {
          endpoint: "/api/real-estate-video/generate",
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
 * Generate voice prompt internally using Gemini.
 */
async function generateVoicePromptInternal(ai, compositeInlineData, script) {
  const prompt = `You are an expert voice casting director for real estate video content.

Look at this image of a person presenting a property. They will speak: "${script}"

The script may include inline emotion tags like {{happy}}, {{sad}}, {{excited}}, {{calm}}. Use these tags to shape delivery, but do NOT speak the tags aloud.

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
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }, { inlineData: compositeInlineData }] }],
  });

  let vp = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!vp || vp.length < 30) throw new Error("Empty voice prompt");
  return vp.replace(/^["']|["']$/g, "");
}

/**
 * Fallback voice prompt if Gemini fails.
 */
function getDefaultVoicePrompt() {
  return "Male or female, age 28-38, polished neutral Indian-English accent with confident urban inflection, medium pitch that drops for authoritative property facts and rises with warm excitement for premium features, rich confident tone with natural warmth, opens with dramatic attention-grabbing hook delivery then transitions to smooth professional walkthrough and closes with aspirational warmth, confident real estate presenter style, deliberate pauses for emphasis on key features, measured pacing around 140 words per minute, recorded on dry close-mic with zero reverb and zero echo, warm chest resonance with natural sibilance, subtle room ambient hum, natural dynamic range, absolutely no robotic or metallic artifacts.";
}

/**
 * Build a cinematic Veo prompt for real estate property showcase.
 */
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
- Voice must sound like a REAL human recording on a quality lavalier mic — warm, present, intimate
- ZERO robotic artifacts: no metallic overtones, no synthetic buzz, no digital clipping
- ZERO echo or reverb — dry, close-mic recording feel
- Natural room tone: very subtle ambient hum
- Voice should have natural chest resonance and body
- Audio dynamics should be natural: louder for hooks, softer for intimate points

VISUAL STYLE:
- Cinematic real estate video quality — premium feel
- Warm, golden natural lighting
- Slight camera movement — slow subtle drift or pan
- Shallow depth of field — presenter sharp, background slightly softer
- Color grading: warm, aspirational, premium

CRITICAL: The person, their clothing, the property, and the setting must exactly match the reference image. No changes to appearance. High-quality synchronized audio throughout. This must look and SOUND like a REAL professional real estate video, not AI.`;
}
