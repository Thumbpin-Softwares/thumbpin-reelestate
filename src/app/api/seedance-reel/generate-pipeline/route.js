export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { R2_PUBLIC_URL } from "@/lib/r2";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { ELEVENLABS_VOICE_SETTINGS } from "@/lib/elevenlabs-config";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

/**
 * POST /api/seedance-reel/generate-pipeline
 *
 * Simplified 2-part real estate reel pipeline:
 *   Part 1 (~15s): Avatar presenter talking — Seedance 2.0 reference-to-video
 *                  with identity images + TTS audio as references.
 *   Part 2 (~30-40s): Property B-roll clips (half Hailuo animated, half static)
 *                     with ElevenLabs voiceover overlay.
 *
 * Client assembles final reel with FFmpeg WASM.
 *
 * SSE events: script_split → voice_part1_ready → seedance_prompt_ready →
 *             seedance_generating → seedance_done → voice_part2_ready →
 *             broll_generating → broll_done → uploading → video_ready → done
 */

async function callLLM(prompt) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY not configured");
  const result = await fal.subscribe("fal-ai/any-llm", {
    input: { model: "anthropic/claude-3-5-haiku", prompt, max_tokens: 2048 },
  });
  return (result?.data?.output ?? result?.output ?? "").toString().trim();
}

async function generateElevenLabsTTS(text, voiceId) {
  const result = await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
    input: {
      text,
      voice: voiceId,
      stability:        ELEVENLABS_VOICE_SETTINGS.stability,
      similarity_boost: ELEVENLABS_VOICE_SETTINGS.similarity_boost,
      style:            ELEVENLABS_VOICE_SETTINGS.style,
      speed:            ELEVENLABS_VOICE_SETTINGS.speed,
    },
    logs: false,
  });
  const audioUrl = result?.data?.audio_url || result?.data?.audio?.url;
  if (!audioUrl) throw new Error("ElevenLabs returned no audio URL");
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download TTS audio: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateHailuoBroll(imageUrl, prompt) {
  const result = await fal.subscribe("fal-ai/minimax/hailuo-02/standard/image-to-video", {
    input: {
      image_url: imageUrl,
      prompt: prompt || "Slow cinematic pan across this luxury real estate property. Natural lighting, no people. 9:16 vertical.",
    },
    logs: false,
  });
  const videoUrl = result?.data?.video?.url;
  if (!videoUrl) throw new Error("Hailuo returned no video URL");
  return videoUrl;
}

export async function POST(request) {
  let userId = null;
  let debit = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    userId = user._id.toString();

    const formData = await request.formData();
    const script = (formData.get("script") || "").toString().trim();
    const voiceId = (formData.get("voiceId") || "21m00Tcm4TlvDq8ikWAM").toString();
    const language = (formData.get("language") || "english").toString();

    if (!script || script.length < 30) {
      return NextResponse.json({ error: "script is required (min 30 chars)" }, { status: 400 });
    }

    // Collect avatar URLs — handle both full https:// URLs (library/uploaded avatars)
    // and relative /api/r2?key=... proxy URLs (prebuilt RE avatars served via the proxy endpoint)
    const avatarUrls = [];
    for (let i = 0; i < 3; i++) {
      const v = formData.get(`avatarUrl_${i}`);
      if (!v || typeof v !== "string") continue;
      if (v.startsWith("http")) {
        avatarUrls.push(v);
      } else if (v.includes("/api/r2?key=") && R2_PUBLIC_URL) {
        // Prebuilt avatar: proxy URL → direct R2 public URL so Seedance can fetch it
        const key = decodeURIComponent(v.split("?key=")[1] || "");
        if (key) avatarUrls.push(`${R2_PUBLIC_URL}/${key}`);
      }
    }
    console.log(`[SeedanceReel] Resolved ${avatarUrls.length} avatar URL(s):`, avatarUrls);

    // Collect location image files (up to 4)
    const locationBufs = [];
    for (let i = 0; i < 4; i++) {
      const f = formData.get(`locationImage_${i}`);
      if (f && typeof f !== "string") {
        try { locationBufs.push(Buffer.from(await f.arrayBuffer())); } catch (_) {}
      }
    }

    if (avatarUrls.length === 0 && locationBufs.length === 0) {
      return NextResponse.json({ error: "At least avatar URLs or location images are required" }, { status: 400 });
    }

    // Debit credits before generation
    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/seedance-reel/generate-pipeline" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    // Upload location images to R2 (cropped 9:16 for Hailuo + Seedance)
    const locationR2Urls = [];
    await Promise.all(
      locationBufs.map(async (buf, i) => {
        try {
          const cropped = await sharp(buf)
            .resize(1080, 1920, { fit: "cover", position: "centre" })
            .jpeg({ quality: 88 })
            .toBuffer();
          const key = buildUserKey(userId, "images", "jpg", `sreel-location-${i}`);
          const url = await uploadToR2(cropped, key, "image/jpeg");
          if (url.startsWith("http")) locationR2Urls[i] = url;
        } catch (e) {
          console.warn(`[SeedanceReel] Failed to upload location image ${i}:`, e.message);
        }
      })
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch (_) {}
        }

        const pingInterval = setInterval(() => send({ type: "ping" }), 3000);

        try {
          // ── Stage 1: Script Split via LLM ─────────────────────────────────
          send({ type: "script_splitting", message: "Splitting script into avatar + B-roll parts…" });

          const splitPrompt = `You are a video script editor. Split the following real estate ad script into exactly TWO parts for a vertical reel video format.

RULES:
- Part 1 (AVATAR TALKING): Must be ≤40 words (~15 seconds at 2.5 words/sec). Must end at a natural sentence boundary. This is what the presenter will speak directly to camera. Choose a hook/intro portion that grabs attention.
- Part 2 (VOICEOVER): Everything remaining from the script. This will play as voiceover behind B-roll property footage.
- Do NOT change any words — only split at a sentence boundary.
- Return ONLY valid JSON, no markdown:

{"part1": "...", "part2": "..."}

SCRIPT:
${script}`;

          let part1 = "";
          let part2 = "";

          try {
            const splitRaw = await callLLM(splitPrompt);
            const jsonMatch = splitRaw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim().match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.part1 && parsed.part2) {
                part1 = parsed.part1.trim();
                part2 = parsed.part2.trim();
              }
            }
          } catch (splitErr) {
            console.warn("[SeedanceReel] LLM split failed, using word-count split:", splitErr.message);
          }

          // Fallback: split by word count if LLM failed
          if (!part1 || !part2) {
            const words = script.split(/\s+/);
            const splitIdx = Math.min(40, Math.floor(words.length * 0.35));
            part1 = words.slice(0, splitIdx).join(" ");
            part2 = words.slice(splitIdx).join(" ");
          }

          const part1Words = part1.split(/\s+/).filter(Boolean).length;
          const part2Words = part2.split(/\s+/).filter(Boolean).length;

          // Dynamic Seedance duration: word count → speech duration + 3s buffer, clamped 10–20s
          const seedanceDuration = String(Math.min(20, Math.max(10, Math.ceil(part1Words / 2.5) + 3)));
          console.log(`[SeedanceReel] Part 1: ${part1Words} words → Seedance duration: ${seedanceDuration}s`);

          // ── Language adaptation: bidirectional script conversion ───────────
          // part1_tts   → Devanagari/native script  → ElevenLabs TTS Part 1
          // part2_tts   → Devanagari/native script  → ElevenLabs TTS Part 2
          // part1_roman → Roman transliteration     → Seedance fixed prompt template
          let part1_tts = part1;    // default: use as-is
          let part2_tts = part2;    // default: use as-is
          let part1_roman = part1;  // default: already Roman

          const langNameMap = {
            english: "English", hindi: "Hindi", hinglish: "Hinglish", marathi: "Marathi",
            tamil: "Tamil", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam",
            bengali: "Bengali", gujarati: "Gujarati", punjabi: "Punjabi", urdu: "Urdu", odia: "Odia",
          };
          const langName = langNameMap[language] || "English";

          // Detect whether part1 already contains native/non-Roman Unicode script chars
          const NATIVE_SCRIPT_RE = /[ऀ-ൿ؀-ۿ]/;
          const part1HasNativeScript = NATIVE_SCRIPT_RE.test(part1);

          const nativeScriptRule = {
            hindi:     "Convert every Hindi/Urdu word to Devanagari script. Keep English brand names, property names, and numbers in Roman.",
            hinglish:  "Convert every Hindi/Urdu word to Devanagari script. English words stay in Roman exactly as written.",
            marathi:   "Convert to full Marathi Devanagari script. English proper nouns stay Roman.",
            bengali:   "Convert to Bengali script (বাংলা). English proper nouns stay Roman.",
            gujarati:  "Convert to Gujarati script (ગુજરાતી). English proper nouns stay Roman.",
            punjabi:   "Convert to Gurmukhi script (ਪੰਜਾਬੀ). English proper nouns stay Roman.",
            urdu:      "Convert to Nastaliq Urdu script. English proper nouns stay Roman.",
            odia:      "Convert to Odia script (ଓଡ଼ିଆ). English proper nouns stay Roman.",
            tamil:     "Convert to Tamil script (தமிழ்). English proper nouns stay Roman.",
            telugu:    "Convert to Telugu script (తెలుగు). English proper nouns stay Roman.",
            kannada:   "Convert to Kannada script (ಕನ್ನಡ). English proper nouns stay Roman.",
            malayalam: "Convert to Malayalam script (മലയാളം). English proper nouns stay Roman.",
          };

          if (language !== "english") {
            if (!part1HasNativeScript && nativeScriptRule[language]) {
              // Input is Roman → convert BOTH parts to native script in one LLM call
              send({ type: "script_adapting", message: `Converting scripts to ${langName} for TTS…` });
              try {
                const adaptPrompt = `You are a script localisation tool. The following ${langName} text is written in Roman transliteration.

TASK: Convert BOTH parts to proper native script for text-to-speech.
RULE: ${nativeScriptRule[language]}
IMPORTANT: Do NOT translate. Do NOT change any words. Only change the writing system.
Return ONLY valid JSON (no markdown):
{"part1": "...", "part2": "..."}

PART 1:
${part1}

PART 2:
${part2}`;
                const adaptRaw = await callLLM(adaptPrompt);
                const match = adaptRaw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim().match(/\{[\s\S]*\}/);
                if (match) {
                  const parsed = JSON.parse(match[0]);
                  if (parsed.part1?.trim().length > 5) part1_tts = parsed.part1.trim();
                  if (parsed.part2?.trim().length > 5) part2_tts = parsed.part2.trim();
                }
              } catch (adaptErr) {
                console.warn("[SeedanceReel] Roman→native conversion failed:", adaptErr.message);
              }
            } else if (part1HasNativeScript) {
              // Input is already native script → use as-is for TTS (both parts)
              part1_tts = part1;
              part2_tts = part2;
              // Still need to transliterate part1 to Roman for Seedance prompt
              send({ type: "script_adapting", message: `Transliterating Part 1 to Roman for Seedance prompt…` });
              try {
                const romanizePrompt = `Transliterate the following ${langName} text from native script to Romanized Latin letters (e.g., Hindi "नमस्ते" → "Namaste", "luxury apartment" stays "luxury apartment"). Keep English brand names and numbers unchanged. Return ONLY the Romanized text.

TEXT:
${part1}`;
                const romanized = await callLLM(romanizePrompt);
                if (romanized && romanized.trim().length > 5) {
                  part1_roman = romanized.trim();
                }
              } catch (romanErr) {
                console.warn("[SeedanceReel] Native→Roman transliteration failed:", romanErr.message);
              }
            }
          }

          send({ type: "script_split", part1, part2, part1Words, part2Words, part1_tts, part1_roman });

          // ── Stage 2: Part 1 TTS (Devanagari/native script for natural pronunciation) ──
          send({ type: "voice_generating", part: 1, message: `Generating Part 1 voice (${part1Words} words)…` });

          let part1AudioUrl = null;
          try {
            const audioBuf = await generateElevenLabsTTS(part1_tts, voiceId);
            const key = buildUserKey(userId, "audio", "mp3", "sreel-part1-voice");
            part1AudioUrl = await uploadToR2(audioBuf, key, "audio/mpeg");
            send({ type: "voice_part1_ready", audioUrl: part1AudioUrl, message: "Part 1 voice ready." });
          } catch (ttsErr) {
            console.error("[SeedanceReel] Part 1 TTS failed:", ttsErr.message);
            send({ type: "voice_warning", message: `Part 1 TTS failed: ${ttsErr.message}` });
          }

          // ── Stage 3: Build Seedance Prompt from FIXED TEMPLATE ────────────
          // The template is always the same car-exit → walk → dialogue → bystanders structure.
          // Only the dialogue slot (part1_roman) and image indices change.
          send({ type: "seedance_prompt_generating", message: "Building Seedance avatar video prompt…" });

          const numAvatarImages = avatarUrls.length;
          const validLocationUrls = locationR2Urls.filter(Boolean);
          const numLocationInSeedance = validLocationUrls.length; // all location images (no cap)

          // Image index references — avatars first, then all location images
          // @Image1..@ImageN  = avatar images
          // @Image(N+1)..end  = location images
          const locationImageRefs = validLocationUrls
            .map((_, i) => `@Image${numAvatarImages + 1 + i}`)
            .join(", ");

          const locationPhrase = locationImageRefs
            ? `into the outdoor entrance area shown in ${locationImageRefs}`
            : "toward the outdoor entrance";

          // Face identity references — use Image1 for body exit pose, extra images for face match
          const faceIdentityRef = numAvatarImages >= 3
            ? `@Image2 and @Image3`
            : numAvatarImages >= 2
            ? `@Image1 and @Image2`
            : `@Image1`;

          // FIXED TEMPLATE — do not change structure; only dialogue and references are variable
          const seedancePrompt =
            `Simple, sleek UGC smartphone vlog footage. The video begins as a luxury white car door opens. ` +
            `@Image1 steps out naturally and walks two steps forward ${locationPhrase}. ` +
            `Her face matches the exact identity, features, and smile of ${faceIdentityRef}. ` +
            `She stands in place, looks directly at the camera lens, and speaks the exact following dialogue words: "${part1_roman}". ` +
            `Her lip movements, mouth openings, and natural facial muscles shape perfectly to the precise spoken syllables, phonetics, and cadence of @Audio1. ` +
            `In the background, out-of-focus bystanders casually walk past the property entrance. ` +
            `Neutral daylight, realistic handheld camera stabilization, natural skin texture with visible pores, and clean, unedited raw video aesthetic.`;

          send({ type: "seedance_prompt_ready", prompt: seedancePrompt, message: "Seedance prompt ready." });

          // ── Stage 4: Call Seedance 2.0 ────────────────────────────────────
          send({ type: "seedance_generating", message: "Generating avatar video via Seedance 2.0 (this takes ~2 minutes)…" });

          let avatarVideoUrl = null;
          try {
            // Build image_urls: avatar images first (max 3), then all location images
            // Seedance reference-to-video supports up to 9 images total (3 avatar + 4 location = 7, safe)
            const seedanceImageUrls = [
              ...avatarUrls.slice(0, 3),
              ...locationR2Urls.filter(Boolean),
            ];
            console.log(`[SeedanceReel] Seedance image_urls (${seedanceImageUrls.length}):`, seedanceImageUrls);

            const seedanceInput = {
              prompt: seedancePrompt,
              aspect_ratio: "9:16",
              duration: seedanceDuration, // explicit seconds so Seedance doesn't cut short
              resolution: "720p",
              generate_audio: true, // Seedance generates its own voice — baked into the video
            };

            if (seedanceImageUrls.length > 0) {
              seedanceInput.image_urls = seedanceImageUrls;
            }
            if (part1AudioUrl) {
              seedanceInput.audio_urls = [part1AudioUrl];
            }

            const seedanceResult = await fal.subscribe("bytedance/seedance-2.0/fast/reference-to-video", {
              input: seedanceInput,
              logs: false,
            });

            const falVideoUrl = seedanceResult?.data?.video?.url;
            if (!falVideoUrl) throw new Error("Seedance returned no video URL");

            const videoRes = await fetch(falVideoUrl);
            if (!videoRes.ok) throw new Error(`Failed to fetch Seedance video: ${videoRes.status}`);
            const videoBuf = Buffer.from(await videoRes.arrayBuffer());
            const key = buildUserKey(userId, "videos", "mp4", "sreel-avatar");
            avatarVideoUrl = await uploadToR2(videoBuf, key, "video/mp4");
            console.log(`[SeedanceReel] Avatar video uploaded: ${avatarVideoUrl}`);
            send({ type: "seedance_done", avatarVideoUrl, message: "Avatar video ready!" });
          } catch (seedanceErr) {
            console.error("[SeedanceReel] Seedance failed:", seedanceErr.message);
            send({ type: "seedance_error", message: `Seedance failed: ${seedanceErr.message}. Continuing with B-roll…` });
          }

          // ── Stage 5: Part 2 TTS ────────────────────────────────────────────
          send({ type: "voice_generating", part: 2, message: `Generating Part 2 voiceover (${part2Words} words)…` });

          let part2AudioUrl = null;
          try {
            const audioBuf = await generateElevenLabsTTS(part2_tts, voiceId); // native script for natural pronunciation
            const key = buildUserKey(userId, "audio", "mp3", "sreel-part2-voice");
            part2AudioUrl = await uploadToR2(audioBuf, key, "audio/mpeg");
            send({ type: "voice_part2_ready", audioUrl: part2AudioUrl, message: "Part 2 voiceover ready." });
          } catch (ttsErr) {
            console.error("[SeedanceReel] Part 2 TTS failed:", ttsErr.message);
            send({ type: "voice_warning", message: `Part 2 TTS failed: ${ttsErr.message}` });
          }

          // ── Stage 6: B-roll Generation (parallel) ─────────────────────────
          // validLocationUrls already declared in Stage 3 — reuse it here
          const brollClips = new Array(validLocationUrls.length).fill(null);

          if (validLocationUrls.length > 0) {
            send({
              type: "broll_generating",
              totalBrolls: validLocationUrls.length,
              message: `Generating ${validLocationUrls.length} B-roll clip(s)…`,
            });

            await Promise.allSettled(
              validLocationUrls.map(async (imgUrl, i) => {
                const isAnimated = i % 2 === 0; // even = Hailuo, odd = static

                if (isAnimated) {
                  try {
                    const falVideoUrl = await generateHailuoBroll(imgUrl, null);
                    const videoRes = await fetch(falVideoUrl);
                    if (!videoRes.ok) throw new Error(`Fetch failed: ${videoRes.status}`);
                    const videoBuf = Buffer.from(await videoRes.arrayBuffer());
                    const key = buildUserKey(userId, "videos", "mp4", `sreel-broll-${i}`);
                    const clipUrl = await uploadToR2(videoBuf, key, "video/mp4");
                    brollClips[i] = { url: clipUrl, isAnimated: true };
                    send({ type: "broll_done", index: i, clipUrl, isAnimated: true, message: `B-roll ${i + 1} done (animated).` });
                  } catch (brollErr) {
                    console.error(`[SeedanceReel] Hailuo failed for broll ${i}, using static:`, brollErr.message);
                    brollClips[i] = { url: imgUrl, isAnimated: false };
                    send({ type: "broll_done", index: i, clipUrl: imgUrl, isAnimated: false, message: `B-roll ${i + 1} done (static fallback).` });
                  }
                } else {
                  // Static image — client does Ken Burns
                  brollClips[i] = { url: imgUrl, isAnimated: false };
                  send({ type: "broll_done", index: i, clipUrl: imgUrl, isAnimated: false, message: `B-roll ${i + 1} added (static).` });
                }
              })
            );
          }

          const validBrolls = brollClips.filter(Boolean);

          // ── Stage 7: Save asset + finalize ────────────────────────────────
          send({ type: "uploading", message: "Saving to your Asset Library…" });

          const primaryUrl = avatarVideoUrl || validBrolls[0]?.url || null;
          if (primaryUrl) {
            try {
              await dbConnect();
              await Asset.create({
                userId,
                name: `Seedance Reel — ${new Date().toLocaleDateString()}`,
                url: primaryUrl,
                type: "clip",
                metadata: {
                  source: "seedance-reel",
                  avatarVideoUrl,
                  part1AudioUrl,
                  brollClips: validBrolls,
                  part2AudioUrl,
                  totalBrolls: validBrolls.length,
                  language,
                },
              });
            } catch (dbErr) {
              console.error("[SeedanceReel] DB save error:", dbErr);
            }
          }

          const totalDuration = 60; // estimate; client will know real duration after assembly

          send({
            type: "video_ready",
            avatarVideoUrl,
            part1AudioUrl,
            brollClips: validBrolls,
            part2AudioUrl,
            totalDuration,
            message: "All assets ready! Assembling final reel…",
          });

          send({ type: "done" });
          clearInterval(pingInterval);
          controller.close();
        } catch (err) {
          clearInterval(pingInterval);
          console.error("[SeedanceReel] Pipeline error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: {
                endpoint: "/api/seedance-reel/generate-pipeline",
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
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[SeedanceReel] Outer error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: {
          endpoint: "/api/seedance-reel/generate-pipeline",
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
