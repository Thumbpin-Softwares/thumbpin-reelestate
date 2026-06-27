export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import SeedanceJob from "@/models/SeedanceJob";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { R2_PUBLIC_URL } from "@/lib/r2";
import {
  consumeCreditsForAction,
  refundCreditsForAction,
} from "@/lib/credit-system";
import { fal } from "@fal-ai/client";
import sharp from "sharp";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

/**
 * POST /api/seedance-reel/generate-pipeline
 *
 * 3-part real estate reel pipeline:
 *   Part 1 (~15s): Avatar presenter — Seedance intro (generate_audio: true)
 *   Part 2 (~12s): Architectural walkthrough — Seedance walkthrough (generate_audio: false)
 *                  with ElevenLabs Part 2 voiceover overlaid by client
 *   Part 3 (~10s): Avatar CTA — Seedance CTA (generate_audio: true)
 *
 * TTS for all 3 parts generated in parallel, then all 3 Seedance calls run in parallel.
 * Client assembles: combineVideos([walkthrough], {fullAudioUrl: part2}) → concatWithAudio([intro, wt, cta])
 */

async function callLLM(prompt) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY not configured");
  const result = await fal.subscribe("fal-ai/any-llm", {
    input: { model: "anthropic/claude-3-5-haiku", prompt, max_tokens: 2048 },
  });
  return (result?.data?.output ?? result?.output ?? "").toString().trim();
}

async function generateElevenLabsTTS(text, voiceId, voiceSettings) {
  const vs = voiceSettings;
  const result = await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
    input: {
      text,
      voice: voiceId,
      stability: vs.stability,
      similarity_boost: vs.similarity_boost,
      style: vs.style,
      speed: vs.speed,
    },
    logs: false,
  });
  const audioUrl = result?.data?.audio_url || result?.data?.audio?.url;
  if (!audioUrl) throw new Error("ElevenLabs returned no audio URL");
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download TTS audio: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateAndUploadTTS(text, voiceId, userId, keyPrefix, voiceSettings) {
  const buf = await generateElevenLabsTTS(text, voiceId, voiceSettings);
  const key = buildUserKey(userId, "audio", "mp3", keyPrefix);
  return uploadToR2(buf, key, "audio/mpeg");
}

async function callSeedanceAndUpload(seedanceInput, userId, keyName) {
  const result = await fal.subscribe(
    "bytedance/seedance-2.0/fast/reference-to-video",
    {
      input: seedanceInput,
      logs: false,
    },
  );
  const falVideoUrl = result?.data?.video?.url;
  if (!falVideoUrl) throw new Error("Seedance returned no video URL");
  const videoRes = await fetch(falVideoUrl);
  if (!videoRes.ok)
    throw new Error(`Failed to fetch Seedance video: ${videoRes.status}`);
  const videoBuf = Buffer.from(await videoRes.arrayBuffer());
  const key = buildUserKey(userId, "videos", "mp4", keyName);
  return uploadToR2(videoBuf, key, "video/mp4");
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
    const voiceId = (
      formData.get("voiceId") || "21m00Tcm4TlvDq8ikWAM"
    ).toString();
    const language = (formData.get("language") || "english").toString();
    const jobId = (formData.get("jobId") || "").toString().trim();
    let voiceSettings = null;
    try {
      const raw = formData.get("voiceSettings");
      if (raw) voiceSettings = JSON.parse(raw.toString());
    } catch (_) {}

    if (!script || script.length < 30) {
      return NextResponse.json(
        { error: "script is required (min 30 chars)" },
        { status: 400 },
      );
    }
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Idempotency guard: refuse a duplicate POST for a jobId that's already
    // running/finished — prevents a stray double-fire from double-billing credits.
    await dbConnect();
    const existingJob = await SeedanceJob.findOne({ jobId }).lean();
    if (existingJob) {
      return NextResponse.json(
        { error: "Job already exists", jobId },
        { status: 409 },
      );
    }

    // Collect avatar URLs — handle full https:// and relative /api/r2?key= proxy URLs
    const avatarUrls = [];
    for (let i = 0; i < 3; i++) {
      const v = formData.get(`avatarUrl_${i}`);
      if (!v || typeof v !== "string") continue;
      if (v.startsWith("http")) {
        avatarUrls.push(v);
      } else if (v.includes("/api/r2?key=") && R2_PUBLIC_URL) {
        const key = decodeURIComponent(v.split("?key=")[1] || "");
        if (key) avatarUrls.push(`${R2_PUBLIC_URL}/${key}`);
      }
    }
    console.log(
      `[SeedanceReel] Resolved ${avatarUrls.length} avatar URL(s):`,
      avatarUrls,
    );

    // Collect location image files (up to 4)
    const locationBufs = [];
    for (let i = 0; i < 4; i++) {
      const f = formData.get(`locationImage_${i}`);
      if (f && typeof f !== "string") {
        try {
          locationBufs.push(Buffer.from(await f.arrayBuffer()));
        } catch (_) {}
      }
    }

    if (avatarUrls.length === 0 && locationBufs.length === 0) {
      return NextResponse.json(
        { error: "At least avatar URLs or location images are required" },
        { status: 400 },
      );
    }

    // Debit credits before generation
    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/seedance-reel/generate-pipeline" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, {
        status: creditResult.status,
      });
    }
    debit = creditResult.debit;

    // Create the persistent job record now that credits are debited — this is
    // the source of truth a refreshed tab can reattach to instead of re-POSTing.
    await SeedanceJob.create({ jobId, userId, status: "running" });

    // Upload location images to R2 (9:16 crop for Seedance)
    const locationR2Urls = [];
    await Promise.all(
      locationBufs.map(async (buf, i) => {
        try {
          const cropped = await sharp(buf)
            .resize(1080, 1920, { fit: "cover", position: "centre" })
            .jpeg({ quality: 88 })
            .toBuffer();
          const key = buildUserKey(
            userId,
            "images",
            "jpg",
            `sreel-location-${i}`,
          );
          const url = await uploadToR2(cropped, key, "image/jpeg");
          if (url.startsWith("http")) locationR2Urls[i] = url;
        } catch (e) {
          console.warn(
            `[SeedanceReel] Failed to upload location image ${i}:`,
            e.message,
          );
        }
      }),
    );

    if (locationBufs.length > 0 && locationR2Urls.filter(Boolean).length === 0) {
      console.error(
        `[SeedanceReel] All ${locationBufs.length} location image upload(s) failed — walkthrough will have no image reference.`,
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );
          } catch (_) {}
        }

        // Persists progress to Mongo so a refreshed/abandoned tab can resume
        // by polling GET /api/seedance-reel/jobs/:jobId instead of re-POSTing
        // (which would double-bill credits and double-fire fal generations).
        async function persistJob(patch) {
          try {
            await SeedanceJob.updateOne({ jobId }, { $set: patch });
          } catch (e) {
            console.error("[SeedanceReel] Job persist failed:", e.message);
          }
        }

        const pingInterval = setInterval(() => send({ type: "ping" }), 3000);

        try {
          // ── Stage 1: 3-Part Script Split via LLM ──────────────────────────
          send({
            type: "script_splitting",
            message: "Splitting script into 3 parts…",
          });

          const splitPrompt = `You are a video script editor. Split this real estate ad script into exactly THREE parts for a vertical reel video.

RULES:
- Part 1 (AVATAR INTRO ≤35 words): Opening hook. The presenter speaks directly to camera with energy and personality. Must end at a natural sentence boundary.
- Part 2 (WALKTHROUGH NARRATION ≤80 words): Property highlights. This plays as voiceover behind a smooth architectural walkthrough. Describes rooms, features, lifestyle.
- Part 3 CTA (≤20 words): Punchy, humorous, memorable call-to-action delivered directly to camera. Make it witty and irresistible.
- Do NOT change, add, or remove any words — split at natural sentence boundaries only.

- Return ONLY valid JSON, no markdown: {"part1": "...", "part2": "...", "part3_cta": "..."}

SCRIPT:
${script}`;

          let part1 = "";
          let part2 = "";
          let part3_cta = "";

          try {
            const splitRaw = await callLLM(splitPrompt);
            const jsonMatch = splitRaw
              .replace(/^```[a-z]*\n?/i, "")
              .replace(/\n?```$/i, "")
              .trim()
              .match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.part1 && parsed.part2 && parsed.part3_cta) {
                part1 = parsed.part1.trim();
                part2 = parsed.part2.trim();
                part3_cta = parsed.part3_cta.trim();
              }
            }
          } catch (splitErr) {
            console.warn(
              "[SeedanceReel] LLM split failed, using word-count split:",
              splitErr.message,
            );
          }

          // Fallback: word-count split
          if (!part1 || !part2 || !part3_cta) {
            const words = script.split(/\s+/);
            const total = words.length;
            const p1End = Math.min(35, Math.floor(total * 0.3));
            const p3Start = Math.max(
              p1End + 1,
              total - Math.min(20, Math.floor(total * 0.2)),
            );
            part1 = words.slice(0, p1End).join(" ");
            part2 = words.slice(p1End, p3Start).join(" ");
            part3_cta = words.slice(p3Start).join(" ");
          }

          const part1Words = part1.split(/\s+/).filter(Boolean).length;
          const part2Words = part2.split(/\s+/).filter(Boolean).length;
          const part3Words = part3_cta.split(/\s+/).filter(Boolean).length;

          // Dynamic durations
          const seedanceDuration = String(
            Math.min(20, Math.max(10, Math.ceil(part1Words / 2.5) + 3)),
          );
          const walkthroughDuration = "12";
          const ctaDuration = "10";
          console.log(
            `[SeedanceReel] Durations — intro:${seedanceDuration}s wt:${walkthroughDuration}s cta:${ctaDuration}s`,
          );

          // ── Language adaptation: bidirectional script conversion ───────────
          let part1_tts = part1,
            part2_tts = part2,
            part3_tts = part3_cta;
          let part1_roman = part1,
            part3_roman = part3_cta;

          const langNameMap = {
            english: "English",
            hindi: "Hindi",
            hinglish: "Hinglish",
            marathi: "Marathi",
            tamil: "Tamil",
            telugu: "Telugu",
            kannada: "Kannada",
            malayalam: "Malayalam",
            bengali: "Bengali",
            gujarati: "Gujarati",
            punjabi: "Punjabi",
            urdu: "Urdu",
            odia: "Odia",
          };
          const langName = langNameMap[language] || "English";

          const NATIVE_SCRIPT_RE = /[ऀ-ൿ؀-ۿ]/;
          const part1HasNativeScript = NATIVE_SCRIPT_RE.test(part1);

          // IMPORTANT: every rule below must keep ALL English words/phrases in Roman —
          // not just proper nouns/numbers. These scripts are written Hinglish-style
          // (heavy code-switching), and an incomplete rule lets the LLM phonetically
          // Devanagari-ize plain English words, which the TTS model then mispronounces
          // as garbled Hindi — producing choppy, unnatural-sounding narration.
          const nativeScriptRule = {
            hindi:
              "Convert every Hindi/Urdu word to Devanagari script.",
            hinglish:
              "Convert every Hindi/Urdu word to Devanagari script. English words stay in Roman exactly as written.",
            marathi:
              "Convert every Marathi word to Devanagari script. Any English word or phrase stays in Roman exactly as written.",
            bengali:
              "Convert every Bengali word to Bengali script (বাংলা). Any English word or phrase stays in Roman exactly as written.",
            gujarati:
              "Convert every Gujarati word to Gujarati script (ગુજરાતી). Any English word or phrase stays in Roman exactly as written.",
            punjabi:
              "Convert every Punjabi word to Gurmukhi script (ਪੰਜਾਬੀ). Any English word or phrase stays in Roman exactly as written.",
            urdu: "Convert every Urdu word to Nastaliq Urdu script. Any English word or phrase stays in Roman exactly as written.",
            odia: "Convert every Odia word to Odia script (ଓଡ଼ିଆ). Any English word or phrase stays in Roman exactly as written.",
            tamil:
              "Convert every Tamil word to Tamil script (தமிழ்). Any English word or phrase stays in Roman exactly as written.",
            telugu:
              "Convert every Telugu word to Telugu script (తెలుగు). Any English word or phrase stays in Roman exactly as written.",
            kannada:
              "Convert every Kannada word to Kannada script (ಕನ್ನಡ). Any English word or phrase stays in Roman exactly as written.",
            malayalam:
              "Convert every Malayalam word to Malayalam script (മലയാളം). Any English word or phrase stays in Roman exactly as written.",
          };

          if (language !== "english") {
            if (!part1HasNativeScript && nativeScriptRule[language]) {
              // Roman → native script: convert all 3 parts in one LLM call
              send({
                type: "script_adapting",
                message: `Converting all parts to ${langName} for TTS…`,
              });
              try {
                const adaptPrompt = `You are a script localisation tool. The following ${langName} text is in Roman transliteration.

TASK: Convert ALL THREE parts to proper native script for text-to-speech.
RULE: ${nativeScriptRule[language]}
IMPORTANT: Do NOT translate. Do NOT change any words. Only change the writing system.
Return ONLY valid JSON (no markdown):
{"part1": "...", "part2": "...", "part3_cta": "..."}

PART 1:
${part1}

PART 2:
${part2}

PART 3 CTA:
${part3_cta}`;
                const adaptRaw = await callLLM(adaptPrompt);
                const match = adaptRaw
                  .replace(/^```[a-z]*\n?/i, "")
                  .replace(/\n?```$/i, "")
                  .trim()
                  .match(/\{[\s\S]*\}/);
                if (match) {
                  const parsed = JSON.parse(match[0]);
                  // All-or-nothing: if any one part fails to convert, applying the
                  // others alone would leave that one part in raw Roman text while
                  // its siblings switch to native script — TTS then reads them as
                  // different languages, producing inconsistent per-part delivery.
                  const allValid =
                    parsed.part1?.trim().length > 5 &&
                    parsed.part2?.trim().length > 5 &&
                    parsed.part3_cta?.trim().length > 5;
                  if (allValid) {
                    part1_tts = parsed.part1.trim();
                    part2_tts = parsed.part2.trim();
                    part3_tts = parsed.part3_cta.trim();
                  } else {
                    console.warn(
                      "[SeedanceReel] Roman→native conversion incomplete — keeping all parts in Roman for consistency:",
                      parsed,
                    );
                  }
                }
              } catch (adaptErr) {
                console.warn(
                  "[SeedanceReel] Roman→native conversion failed:",
                  adaptErr.message,
                );
              }
            } else if (part1HasNativeScript) {
              // Already native script → transliterate part1 + part3_cta to Roman for Seedance prompts
              send({
                type: "script_adapting",
                message: `Transliterating intro + CTA to Roman for Seedance prompts…`,
              });
              try {
                const romanizePrompt = `Transliterate the following ${langName} texts from native script to Romanized Latin letters. Keep English brand names and numbers unchanged.
Return ONLY valid JSON (no markdown):
{"part1_roman": "...", "part3_roman": "..."}

TEXT 1 (intro):
${part1}

TEXT 2 (CTA):
${part3_cta}`;
                const romanRaw = await callLLM(romanizePrompt);
                const match = romanRaw
                  .replace(/^```[a-z]*\n?/i, "")
                  .replace(/\n?```$/i, "")
                  .trim()
                  .match(/\{[\s\S]*\}/);
                if (match) {
                  const parsed = JSON.parse(match[0]);
                  if (parsed.part1_roman?.trim().length > 5)
                    part1_roman = parsed.part1_roman.trim();
                  if (parsed.part3_roman?.trim().length > 5)
                    part3_roman = parsed.part3_roman.trim();
                }
              } catch (romanErr) {
                console.warn(
                  "[SeedanceReel] Native→Roman transliteration failed:",
                  romanErr.message,
                );
              }
            }
          }

          send({
            type: "script_split",
            part1,
            part2,
            part3_cta,
            part1Words,
            part2Words,
            part3Words,
          });
          await persistJob({
            status: "splitting",
            part1,
            part2,
            part3Cta: part3_cta,
          });

          // ── Stage 2: Generate all 3 TTS in parallel ───────────────────────
          send({
            type: "voice_generating",
            message: "Generating voiceovers for all 3 parts in parallel…",
          });

          const [p1TtsResult, p2TtsResult, p3TtsResult] =
            await Promise.allSettled([
              generateAndUploadTTS(
                part1_tts,
                voiceId,
                userId,
                "sreel-part1-voice",
                voiceSettings,
              ),
              generateAndUploadTTS(
                part2_tts,
                voiceId,
                userId,
                "sreel-part2-voice",
                voiceSettings,
              ),
              generateAndUploadTTS(
                part3_tts,
                voiceId,
                userId,
                "sreel-part3-voice",
                voiceSettings,
              ),
            ]);

          let part1AudioUrl = null,
            part2AudioUrl = null,
            part3AudioUrl = null;
          if (p1TtsResult.status === "fulfilled") {
            part1AudioUrl = p1TtsResult.value;
          } else
            console.error(
              "[SeedanceReel] Part 1 TTS failed:",
              p1TtsResult.reason?.message,
            );
          if (p2TtsResult.status === "fulfilled") {
            part2AudioUrl = p2TtsResult.value;
          } else
            console.error(
              "[SeedanceReel] Part 2 TTS failed:",
              p2TtsResult.reason?.message,
            );
          if (p3TtsResult.status === "fulfilled") {
            part3AudioUrl = p3TtsResult.value;
          } else
            console.error(
              "[SeedanceReel] Part 3 TTS failed:",
              p3TtsResult.reason?.message,
            );

          send({
            type: "voice_all_ready",
            part1AudioUrl,
            part2AudioUrl,
            part3AudioUrl,
          });
          await persistJob({
            status: "voices",
            part1AudioUrl,
            part2AudioUrl,
            part3AudioUrl,
          });

          // ── Stage 3: Build 3 Seedance prompts ─────────────────────────────
          const numAvatarImages = avatarUrls.length;
          const validLocationUrls = locationR2Urls.filter(Boolean);
          const numLocImgs = validLocationUrls.length;

          // ── Prompt A: Intro avatar (car → walk → dialogue, same proven template) ──
          const faceIdentityRef =
            numAvatarImages >= 3
              ? `#Image2 and #Image3`
              : numAvatarImages >= 2
                ? `#Image1 and #Image2`
                : `#Image1`;
          const locationImageRefs = validLocationUrls
            .map((_, i) => `#Image${numAvatarImages + 1 + i}`)
            .join(", ");
          const locationPhrase = locationImageRefs
            ? `into the outdoor entrance area shown in ${locationImageRefs}`
            : "toward the outdoor entrance";

            const introPrompt =
            `Simple, sleek UGC smartphone vlog footage. #Image1 shows her exiting a luxury car and walking toward the camera while speaking directly to the lens. ` +
            `Her face matches the exact identity of ${faceIdentityRef}. ` +
            `She speaks the following dialogue: "${part1_roman}". ` +
            `Her lip movements sync perfectly to the audio in #Audio1. ` +
            `Natural daylight, handheld camera, realistic raw video aesthetic.`;

          // ── Prompt B: Architectural walkthrough (location images only, no avatar) ──
          let walkthroughPrompt = `A seamless, continuous 12-second architectural walkthrough video with zero hard cuts. `;
          if (numLocImgs >= 1)
            walkthroughPrompt += `The camera begins at the exterior facade and environment shown in #Image1, slowly pushing forward toward the main entrance. `;
          if (numLocImgs >= 2)
            walkthroughPrompt += `The camera fluidly morphs through the threshold to reveal the interior space depicted in #Image2, panning gently to highlight the ambient features and decor. `;
          if (numLocImgs >= 3)
            walkthroughPrompt += `Maintaining smooth stabilized handheld momentum, the camera pushes through an archway into the next adjoining space shown in #Image3, tracking smoothly across the room. `;
          if (numLocImgs >= 4)
            walkthroughPrompt += `The camera glides forward, transitioning effortlessly into the environment shown in #Image4, accentuating the unique spatial layout and design elements. `;
          walkthroughPrompt += `The entire 12-second progression is one fluid, unbroken sequence — hyper-realistic textures, consistent interior lighting transitions, soft shadows, and clean 4K architectural rendering quality.`;
          if (part2AudioUrl)
            walkthroughPrompt += ` Camera pacing and transitions are dynamically synchronized with the rhythm of #Audio1.`;

          // ── Prompt C: CTA avatar (confident, charming, hooky closing) ──────
          const ctaBgRef =
            numLocImgs > 0
              ? ` against the stunning property backdrop in #Image${numAvatarImages + 1}`
              : "";
          const ctaPrompt =
            `Sleek, punchy UGC smartphone vlog footage. #Image1 turns back toward the camera with a charismatic, wide grin${ctaBgRef}. ` +
            `Her face matches the exact identity and confident energy of ${faceIdentityRef}. ` +
            `She leans slightly toward the camera lens with sparkling eyes and delivers the closing line with irresistible charm: "${part3_roman}". ` +
            `Her lip movements and natural expressions match perfectly to the syllables and cadence of #Audio1. ` +
            `She finishes with a bright, unforgettable smile directly into the lens — leaving no doubt about what to do next. ` +
            `Warm, soft property bokeh background, handheld micro-movement, natural skin texture. Confident, witty, memorable.`;

          send({
            type: "seedance_prompt_ready",
            introPrompt,
            walkthroughPrompt,
            ctaPrompt,
            message: "All 3 Seedance prompts ready.",
          });

          // ── Stage 4: All 3 Seedance calls in parallel ─────────────────────
          send({
            type: "seedance_generating",
            message:
              "Generating 3 videos in parallel via Seedance 2.0 (takes ~3–7 min)…",
          });
          await persistJob({ status: "seedance" });

          // Intro: avatar images + all location images; 720p; baked audio
          const introImageUrls = [
            ...avatarUrls.slice(0, 3),
            ...validLocationUrls,
          ];
          // fal rejects audio_urls unless image_urls/video_urls is also present —
          // nest audio inside the same guard so a clip never gets sent audio-only.
          const introInput = {
            prompt: introPrompt,
            aspect_ratio: "9:16",
            duration: seedanceDuration,
            resolution: "720p",
            generate_audio: true,
            ...(introImageUrls.length > 0 && {
              image_urls: introImageUrls,
              ...(part1AudioUrl && { audio_urls: [part1AudioUrl] }),
            }),
          };

          // Walkthrough: location images only; 480p; no baked audio (Part 2 TTS overlaid by client)
          const walkthroughInput = {
            prompt: walkthroughPrompt,
            aspect_ratio: "9:16",
            duration: walkthroughDuration,
            resolution: "480p",
            generate_audio: false,
            ...(validLocationUrls.length > 0 && {
              image_urls: validLocationUrls,
              ...(part2AudioUrl && { audio_urls: [part2AudioUrl] }), // pacing reference only
            }),
          };

          // CTA: avatar images + up to 2 location images for backdrop context; 720p; baked audio
          const ctaImageUrls = [
            ...avatarUrls.slice(0, 3),
            ...validLocationUrls.slice(0, 2),
          ];
          const ctaInput = {
            prompt: ctaPrompt,
            aspect_ratio: "9:16",
            duration: ctaDuration,
            resolution: "720p",
            generate_audio: true,
            ...(ctaImageUrls.length > 0 && {
              image_urls: ctaImageUrls,
              ...(part3AudioUrl && { audio_urls: [part3AudioUrl] }),
            }),
          };

          console.log(
            `[SeedanceReel] Intro image_urls (${introInput.image_urls?.length ?? 0}):`,
            introInput.image_urls,
          );
          console.log(
            `[SeedanceReel] Walkthrough image_urls (${walkthroughInput.image_urls?.length ?? 0}):`,
            walkthroughInput.image_urls,
          );

          let avatarVideoUrl = null;
          let walkthroughVideoUrl = null;
          let ctaVideoUrl = null;

          // Fire all 3 simultaneously; send SSE events as each one resolves
          await Promise.allSettled([
            callSeedanceAndUpload(introInput, userId, "sreel-avatar")
              .then((url) => {
                avatarVideoUrl = url;
                console.log("[SeedanceReel] Intro avatar uploaded:", url);
                send({
                  type: "seedance_done",
                  avatarVideoUrl: url,
                  message: "Intro avatar video ready!",
                });
                persistJob({ avatarVideoUrl: url });
              })
              .catch((err) => {
                console.error(
                  "[SeedanceReel] Intro Seedance failed:",
                  err.message,
                );
                send({
                  type: "seedance_error",
                  message: `Intro video failed: ${err.message}`,
                });
              }),

            callSeedanceAndUpload(walkthroughInput, userId, "sreel-walkthrough")
              .then((url) => {
                walkthroughVideoUrl = url;
                console.log("[SeedanceReel] Walkthrough uploaded:", url);
                send({
                  type: "walkthrough_done",
                  walkthroughVideoUrl: url,
                  message: "Architectural walkthrough ready!",
                });
                persistJob({ walkthroughVideoUrl: url });
              })
              .catch((err) => {
                console.error(
                  "[SeedanceReel] Walkthrough Seedance failed:",
                  err.message,
                );
                send({
                  type: "seedance_error",
                  message: `Walkthrough failed: ${err.message}`,
                });
              }),

            callSeedanceAndUpload(ctaInput, userId, "sreel-cta")
              .then((url) => {
                ctaVideoUrl = url;
                console.log("[SeedanceReel] CTA avatar uploaded:", url);
                send({
                  type: "seedance_cta_done",
                  ctaVideoUrl: url,
                  message: "CTA avatar video ready!",
                });
                persistJob({ ctaVideoUrl: url });
              })
              .catch((err) => {
                console.error(
                  "[SeedanceReel] CTA Seedance failed:",
                  err.message,
                );
                send({
                  type: "seedance_error",
                  message: `CTA video failed: ${err.message}`,
                });
              }),
          ]);

          // ── Stage 5: Save asset + finalize ────────────────────────────────
          send({ type: "uploading", message: "Saving to your Asset Library…" });

          const primaryUrl =
            avatarVideoUrl || walkthroughVideoUrl || ctaVideoUrl;
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
                  walkthroughVideoUrl,
                  ctaVideoUrl,
                  part1AudioUrl,
                  part2AudioUrl,
                  part3AudioUrl,
                  language,
                },
              });
            } catch (dbErr) {
              console.error("[SeedanceReel] DB save error:", dbErr);
            }
          }

          const totalDuration = 37; // ~15 + 12 + 10; client knows real duration after assembly

          send({
            type: "video_ready",
            avatarVideoUrl,
            walkthroughVideoUrl,
            ctaVideoUrl,
            part2AudioUrl,
            totalDuration,
            message: "All assets ready! Assembling final reel…",
          });
          await persistJob({
            status: "done",
            avatarVideoUrl,
            walkthroughVideoUrl,
            ctaVideoUrl,
            part2AudioUrl,
          });

          send({ type: "done" });
          clearInterval(pingInterval);
          controller.close();
        } catch (err) {
          clearInterval(pingInterval);
          console.error("[SeedanceReel] Pipeline error:", err);
          await persistJob({
            status: "error",
            error: err.message || "Pipeline failed",
          });

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
      { status: 500 },
    );
  }
}
