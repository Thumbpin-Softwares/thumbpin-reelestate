import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
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
    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "User not found. Please sign out and sign in again." }, { status: 404 });
    }
    userId = user._id.toString();

    const formData = await request.formData();
    const compositeFile = formData.get("compositeImage");
    const script = formData.get("script");
    const language = formData.get("language") || "hindi";
    // Voice prompt: generated internally, OR provided as sharedVoicePrompt for voice consistency across batch
    let voicePrompt = formData.get("voicePrompt") || "";
    const sharedVoicePrompt = formData.get("sharedVoicePrompt") || "";

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\\n\\n`));
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
          // ── Step 1: Determine voice prompt ─────────────────────────────
          if (sharedVoicePrompt && sharedVoicePrompt.trim().length > 20) {
            // Use the shared voice from the first video — ensures consistency across the batch
            voicePrompt = sharedVoicePrompt;
            send({
              type: "progress",
              videoIndex: 0,
              status: "voice",
              message: "🎙️ Using shared voice for consistency across your walkthrough...",
            });
          } else if (!voicePrompt || voicePrompt.trim().length < 20) {
            // Generate voice internally from the composite image
            send({
              type: "progress",
              videoIndex: 0,
              status: "voice",
              message: "🎙️ Crafting the perfect voice for your presenter...",
            });

            try {
              voicePrompt = await generateVoicePromptInternal(ai, compositeInlineData, script, language);
              console.log("[RealEstateVideo] Voice prompt generated internally");
            } catch (vpErr) {
              console.error("[RealEstateVideo] Voice prompt gen failed, using default:", vpErr.message);
              voicePrompt = getDefaultVoicePrompt();
            }
          }

          // Emit voice_ready event so the frontend can capture and reuse this voice for subsequent clips
          send({
            type: "voice_ready",
            voicePrompt,
          });

          // ── Step 2: Generate video with Veo 3.1 ────────────────────────
          send({
            type: "progress",
            videoIndex: 0,
            status: "generating",
            message: "🏠 Generating your property video with Veo 3.1...",
          });

          const veoPrompt = buildVideoPrompt(script, voicePrompt, language);

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

          const result = await pollOperation(generationOp);

          const generatedVideo =
            result?.generatedVideos?.[0]?.video ||
            result?.response?.generatedVideos?.[0]?.video ||
            result?.response?.generatedVideos?.[0]?.videoResponse;

          if (!generatedVideo) {
            console.error("[RealEstateVideo] Unexpected Veo response shape:", {
              keys: result ? Object.keys(result) : null,
              generatedVideos: result?.generatedVideos,
              responseKeys: result?.response ? Object.keys(result.response) : null,
            });
            throw new Error("Video generation returned no video. The prompt may have been rejected or Veo returned an unexpected response shape.");
          }

          const uriParts = generatedVideo.uri.split("/");
          const fileName = uriParts.pop() || "";
          const fileId = fileName.split(":")[0].split("?")[0];
          const proxyUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;

          // ── Upload video to R2 ─────────────────────────────────────────
          let localVideoUrl = proxyUrl;
          try {
            send({
              type: "progress",
              videoIndex: 0,
              status: "saving",
              message: "☁️ Saving video to cloud storage...",
            });

            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}&alt=media`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const key = buildUserKey(userId, "videos", "mp4", "real-estate");
            localVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
            console.log(`[RealEstateVideo] Uploaded to R2: ${key} (${(videoBytes.length / 1024 / 1024).toFixed(1)} MB)`);
          } catch (saveErr) {
            console.error("[RealEstateVideo] R2 upload failed, using proxy URL:", saveErr.message);
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
async function generateVoicePromptInternal(ai, compositeInlineData, script, language = "hindi") {
  const languageRules = {
    english: "The speech should be in clear Indian-English with a neutral urban Indian accent.",
    hindi: "The speech should be in natural Hindi with a polished North Indian delivery.",
    hinglish: "The speech should blend Hindi and English naturally in urban Hinglish.",
    marathi: "The speech should be in fluent Marathi with a warm Maharashtrian delivery.",
    tamil: "The speech should be in fluent Tamil with a natural Chennai/Coastal Tamil cadence.",
    telugu: "The speech should be in fluent Telugu with a smooth, warm delivery.",
    kannada: "The speech should be in fluent Kannada with a calm, confident delivery.",
    malayalam: "The speech should be in fluent Malayalam with a refined, natural delivery.",
    bengali: "The speech should be in fluent Bengali with a soft, expressive delivery.",
    gujarati: "The speech should be in fluent Gujarati with a bright, friendly delivery.",
    punjabi: "The speech should be in fluent Punjabi with a warm, energetic delivery.",
    urdu: "The speech should be in fluent Urdu with an elegant, expressive delivery.",
    odia: "The speech should be in fluent Odia with a smooth, natural delivery.",
  };
  const languageRule = languageRules[language] || languageRules.hindi;

  const prompt = `You are a professional voice casting director for a luxury real estate video. Study the person in the image and design the most believable on-camera presenter voice possible for this exact video.

They will speak this script verbatim:
"${script}"

Language/accent direction:
${languageRule}

Important: emotion tags like {{happy}}, {{confident}}, or {{warm}} are only for delivery guidance and must never be spoken aloud.

Return exactly ONE paragraph, comma-separated, with these elements in this order:
1. gender and age range that best match the person,
2. precise accent and regional texture,
3. pitch range and tonal character,
4. emotional delivery arc across the full video: strong opening hook, smooth guided walkthrough, and polished aspirational closing,
5. natural expressiveness and emphasis patterns,
6. pacing around 140 words per minute with clear pauses before key property details,
7. recording characteristics: dry close-mic studio capture, intimate presence, zero reverb, zero echo, zero room noise, zero hiss, zero hum, zero clipping, zero robotic texture, warm chest resonance, realistic breath control, and natural dynamic range.

The voice must feel like a real premium property presenter: credible, calm, affluent, friendly, articulate, and camera-confident, with subtle enthusiasm rather than exaggerated performance. Return ONLY the paragraph, with no heading, no bullets, no labels, and no explanation.`;

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
  return "Male or female, age 28-38, polished neutral Indian-English accent with confident urban inflection, medium pitch with natural variation, rich warm authoritative tone, natural conversational presenter delivery, dynamic prosody with slightly faster/louder emphasis on highlights and softer/slower delivery on premium details, deliberate pauses before key features, measured pacing around 140 words per minute, recorded on dry close-mic (4-6 inches) in treated studio conditions, zero reverb, zero echo, zero surrounding noise, zero hiss or hum, zero surround sound, warm chest resonance with natural sibilance, natural dynamic range, absolutely no robotic or metallic artifacts.";
}

/**
 * Build a cinematic Veo prompt for real estate property showcase.
 */
function buildVideoPrompt(script, voicePrompt, language = "hindi") {
  const LANGUAGE_LINE = {
    english: "Indian-English", hindi: "natural Hindi", hinglish: "natural Hinglish",
    marathi: "fluent Marathi", tamil: "fluent Tamil", telugu: "fluent Telugu",
    kannada: "fluent Kannada", malayalam: "fluent Malayalam", bengali: "fluent Bengali",
    gujarati: "fluent Gujarati", punjabi: "fluent Punjabi", urdu: "fluent Urdu", odia: "fluent Odia",
  }[language] || "natural Hindi";

  // Detect if script is already a cinematic director's brief from generate-script
  const isCinematicPrompt = script.length > 120 || /camera|push.in|pull.back|dolly|handheld|whip.pan|presenter|shot/i.test(script);

  const SHARED_CONSTRAINTS = `
VOICE: ${voicePrompt}. Lip movements perfectly synced and natural to the spoken line timing.
Language: ${LANGUAGE_LINE}.
AUDIO: Single presenter voice only — dry close-mic, clean studio sound, zero reverb, zero echo, zero background music, zero ambient voices, zero SFX, zero robotic artifacts, no distortions, no compression pumping.
VIDEO: Must remain faithful to the reference image for the presenter identity, clothing style, and property context. No text, no captions, no overlays, no watermarks, no graphics, no subtitles, no logo bugs.
FACE AND SKIN: Ultra-photorealistic human skin with natural pores, micro-shadows, subtle under-eye texture, realistic teeth, believable eye reflections, natural blink cadence, and no airbrushed or plastic appearance.
CAMERA: Medium-wide to wide framing, slow Steadicam-style motion, stable horizon, gentle cinematic parallax, realistic lens behavior, no aggressive zooms, no jitter, no warped perspective, no unnatural face close-ups.
LIGHTING: Natural interior daylight or warm mixed real-estate lighting, believable shadow falloff, soft highlights, realistic reflections on glass, metal, and polished surfaces.
MOOD: Premium, aspirational, tasteful, modern, high-trust real estate marketing with authentic presenter energy.
FORMAT: 9:16 portrait, optimized for Instagram Reels / Shorts, but still must look like a real property walkthrough shot on a professional camera.`;

  if (isCinematicPrompt) {
    return `Ultra-realistic premium real estate showcase video, 9:16 portrait for Instagram Reels / YouTube Shorts.

CINEMATIC DIRECTION:
${script}

VISUAL QUALITY:
Photorealistic, polished, elegant, highly believable property walkthrough. Interior details should look physically consistent and grounded in a real home. Maintain realistic room geometry, truthful proportions, natural reflections, and clean composition.

${SHARED_CONSTRAINTS}`;
  }

  // Fallback: plain dialogue
  return `Ultra-realistic real estate property showcase video, 9:16 portrait for Instagram Reels / YouTube Shorts.
Presenter (exactly as in reference image) stands naturally inside the property and speaks directly to camera with confident warmth and premium realtor energy.

PERFORMANCE:
The presenter should feel like a real experienced agent, with relaxed posture, subtle hand gestures, natural head movement, occasional small smiles, and one or two moments of stepping slightly aside to reveal the room more clearly. Delivery should be smooth, articulate, persuasive, and human — energetic at the opening, steady through the walkthrough, and aspirational at the close.

SCRIPT:
"${script}"

Language:
${LANGUAGE_LINE}

ENVIRONMENT:
The property should remain continuously visible around the presenter, with believable room depth, accurate scale, tasteful staging, clean surfaces, and realistic lighting. Use warm, inviting, luxury-leaning real estate cinematography with natural motion and grounded visual behavior. The result should feel like a genuine professional property tour, not an advertisement with artificial effects.

${SHARED_CONSTRAINTS}`;
}