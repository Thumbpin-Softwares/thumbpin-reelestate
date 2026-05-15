import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

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

  const prompt = `You are an expert voice casting director for real estate video content.

Look at this image of a person presenting a property. They will speak: "${script}"

LANGUAGE / ACCENT REQUIREMENT:
${languageRule}

The script may include inline emotion tags like {{happy}}, {{sad}}, {{excited}}, {{calm}}. Use these tags to shape delivery, but do NOT speak the tags aloud.

Generate a DETAILED voice description. The voice must sound like a CONFIDENT REAL ESTATE PROFESSIONAL — warm, authoritative, aspirational.
The speaking style must be NATURAL and HUMAN — like a real presenter talking to camera, not a voice assistant.

Return a single paragraph with ALL attributes comma-separated:
- Gender and age range
- Accent type (specific — e.g., "neutral Indian-English accent")
- Pitch level and variation
- Tone quality (warm, confident, rich, authoritative, inviting)
- Emotional delivery arc: opens with hook energy, transitions to smooth walkthrough, ends aspirational
- Expressive prosody: dynamic volume/pacing (slightly louder/faster on highlights, softer/slower on premium details), natural emphasis on key words
- Speaking style: confident real estate presenter, NOT stiff
- Vocal expressiveness (dramatic pauses before key features, voice drops for intimate moments)
- Pacing: measured but engaging, ~140 wpm
- RECORDING QUALITY (STRICT): dry close-mic (4-6 inches), studio-clean signal, zero reverb, zero echo, zero surrounding/room noise, zero crowd noise, zero wind noise, zero hiss/hum/buzz, zero surround sound, zero robotic artifacts, warm chest resonance, natural sibilance, natural dynamic range

CRITICAL AUDIO OUTPUT RULE:
- The final result must sound like a presenter speaking directly into a close mic in a treated room.
- No "echo echo" effect, no distant-room tone, no hall ambience, no bathroom-like reflections.

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
  return "Male or female, age 28-38, polished neutral Indian-English accent with confident urban inflection, medium pitch with natural variation, rich warm authoritative tone, natural conversational presenter delivery, dynamic prosody with slightly faster/louder emphasis on highlights and softer/slower delivery on premium details, deliberate pauses before key features, measured pacing around 140 words per minute, recorded on dry close-mic (4-6 inches) in treated studio conditions, zero reverb, zero echo, zero surrounding noise, zero hiss or hum, zero surround sound, warm chest resonance with natural sibilance, natural dynamic range, absolutely no robotic or metallic artifacts.";
}

/**
 * Build a cinematic Veo prompt for real estate property showcase.
 */
function buildVideoPrompt(script, voicePrompt, language = "hindi") {
  const SKIN_TOKENS = `Photorealistic detail. Real human skin with visible natural texture, pores, and micro shadows. Preserve natural under-eye detail and realistic lip texture. No airbrushing or waxy finish. Authentic facial structure with natural micro-expressions and eye depth. Lighting behaves naturally with soft highlights and realistic shadows. High-detail editorial realism, grounded in real-world 4k camera capture.`;

  const AUDIO_REALISM = `AUDIO REALISM (CRITICAL — NO ROBOTIC ARTIFACTS):
- Voice must sound like a REAL human recording on a premium close mic (lavalier or boom) — warm, present, intimate
- ZERO robotic artifacts: no metallic overtones, no synthetic buzz, no digital clipping
- ZERO echo or reverb — dry, close-mic recording feel only
- ZERO surrounding noise: no room reflections, no crowd, no traffic, no fan/AC noise, no wind, no hiss/hum
- ZERO background sounds of any kind: no ending sound, no transition whoosh, no cinematic hits, no swells, no ambience bed, no foley tails
- ZERO background voices: no second speaker, no chatter, no murmur, no off-screen dialogue
- ONLY one clear voice track: the avatar/presenter voice and nothing else
- Voice should have natural chest resonance and body
- Natural expressive dynamics: slightly louder/faster on hooks & highlights, softer/slower on emotional or premium details
- Preserve natural emotional shifts so delivery feels human and spontaneous`;

  const VOICE_LINE = `VOICE CHARACTERISTICS: ${voicePrompt}
- Lip movements must be perfectly synchronized with speech at all times`;

  const LANGUAGE_LINE = {
    english: "The presenter speaks in clear Indian-English.",
    hindi: "The presenter speaks in natural Hindi.",
    hinglish: "The presenter speaks in natural Hinglish.",
    marathi: "The presenter speaks in fluent Marathi.",
    tamil: "The presenter speaks in fluent Tamil.",
    telugu: "The presenter speaks in fluent Telugu.",
    kannada: "The presenter speaks in fluent Kannada.",
    malayalam: "The presenter speaks in fluent Malayalam.",
    bengali: "The presenter speaks in fluent Bengali.",
    gujarati: "The presenter speaks in fluent Gujarati.",
    punjabi: "The presenter speaks in fluent Punjabi.",
    urdu: "The presenter speaks in fluent Urdu.",
    odia: "The presenter speaks in fluent Odia.",
  }[language] || "The presenter speaks in natural Hindi.";

  const REALISM_FOOTER = `CRITICAL CONSTRAINTS:
- The person, their clothing, the property, and the setting must EXACTLY match the reference image
- No changes to appearance whatsoever
- High-quality synchronized audio throughout
- This must look and SOUND like a REAL professional real estate video — not AI-generated
- Audio must be single-speaker clean close-mic only. Absolutely no background SFX/music/transition sounds/ambient tails.
- Audio must be single-speaker clean close-mic only. Absolutely no background SFX/music/transition sounds/ending sounds/ambient tails.
- ❌ ABSOLUTELY NO TEXT ON SCREEN — no captions, no subtitles, no titles, no overlays, no watermarks, no on-screen text of any kind. Clean video only.
- ❌ NO GRAPHICS, NO LOGOS, NO UI ELEMENTS overlaid on the video
- ${SKIN_TOKENS}`;

  // ── Detect cinematic prompt (generated by generate-script endpoint) ──────────
  // A cinematic prompt is typically longer and contains camera/action language.
  const isCinematicPrompt = script.length > 120 || /camera|push.in|pull.back|rack focus|dolly|handheld|whip.pan|presenter|shot/i.test(script);

  const CAMERA_RULES = `CAMERA MOVEMENT RULES (CRITICAL — REAL ESTATE STYLE):
- ❌ NEVER zoom into the presenter's face — no close-up face shots
- ❌ NEVER use aggressive zoom, whip-pan, or shaky handheld camera
- ❌ NEVER crop tight on the presenter — always show the property environment
- ✅ Keep the presenter at MEDIUM to WIDE framing — the property is the star
- ✅ Use SLOW, SMOOTH, ELEGANT camera movements — think luxury real estate cinematography
- ✅ Steadicam-style tracking: slow lateral dolly, gentle push-in from wide, subtle tracking
- ✅ Camera speed: very slow and deliberate — like a high-end property showcase
- ✅ If following the presenter walking, maintain consistent medium-wide distance
- ✅ Subtle depth-of-field: presenter sharp, property environment slightly soft but visible`;

  if (isCinematicPrompt) {
    // The script IS already a director's brief — wrap with realism tokens and camera rules
    return `Ultra-realistic real estate property showcase video in 9:16 portrait format for Instagram Reels / YouTube Shorts.

CINEMATIC DIRECTION:
${script}

${CAMERA_RULES}

${VOICE_LINE}

${AUDIO_REALISM}

${REALISM_FOOTER}`;
  }

  // ── Fallback: plain dialogue — use original detailed template ──────────────
  return `Ultra-realistic real estate property showcase video in 9:16 portrait format. This should look EXACTLY like a professional real estate influencer's property tour on Instagram Reels or YouTube Shorts. The person (exactly as seen in the reference image) is standing inside the property and presenting it directly to the camera with confident enthusiasm.

PRESENTER ENERGY & BODY LANGUAGE:
- The presenter is CONFIDENT and WARM — like a top real estate creator who genuinely believes this is the perfect property
- Professional warm smile — inviting and trustworthy
- Confident hand gestures — sweeping arm movements to showcase the space, pointing to features, gesturing toward windows/views
- Natural head movements — slight nods of approval, looking around the space then back to camera
- Professional posture — confident stance, slight lean toward camera for intimate moments
- At least ONE moment where they step to the side or gesture widely to reveal more of the space behind them

SPEAKING STYLE (VERY IMPORTANT):
- Natural conversational delivery — do not sound scripted, stiff, or robotic
- Emotionally expressive and dynamic like a real property host
- Slight speed/energy lift on highlight words, then softer delivery for premium details
- Use meaningful pauses to let key points land

PROPERTY SHOWCASE MOMENTS:
- The property/space is clearly visible around and behind the presenter throughout
- Natural light from windows enhances the premium feel
- The property should look aspirational, well-lit, and inviting

SPEECH AND AUDIO:
- The person speaks the following with confident warmth and real estate presenter energy: "${script}"
- ${LANGUAGE_LINE}
- ${VOICE_LINE}
- Delivery should feel professional but genuine — like a trusted advisor showing you your dream home
- Hook delivery should be attention-grabbing — designed to stop the scroll

${AUDIO_REALISM}

VISUAL STYLE:
- Cinematic real estate video quality — premium feel
- Warm, golden natural lighting
- SLOW, SMOOTH camera movement only — gentle drift, slow dolly, subtle pan
- ❌ NO zoom to face, NO close-ups of the presenter, NO aggressive camera moves
- ✅ MEDIUM to WIDE framing — always show the property environment around the presenter
- Shallow depth of field — presenter sharp, background slightly softer
- Color grading: warm, aspirational, premium
- Think: luxury real estate cinematography, Steadicam-style elegance

${CAMERA_RULES}

${REALISM_FOOTER}`;
}


