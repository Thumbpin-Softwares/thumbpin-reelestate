export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import SeedanceJob from "@/models/SeedanceJob";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey, extFromMime } from "@/lib/r2-upload";
import { R2_PUBLIC_URL } from "@/lib/r2";
import {
  consumeCreditsForAction,
  refundCreditsForAction,
} from "@/lib/credit-system";
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { synthesizeVoice } from "@/lib/voice-tts";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

/**
 * POST /api/action-reel/generate-pipeline
 *
 * 2-part high-energy UGC real estate reel:
 *   Part 1 (~15s): Hook/intro — single Seedance clip, multiple internal hard
 *                  cuts, Seedance-baked lip-synced dialogue (generate_audio: true)
 *   Part 2 (~15s): Highlights + CTA — same shape, different dialogue
 *
 * Both Seedance prompts are produced by asking the LLM to REPRODUCE one of the
 * two MASTER TEMPLATES below exactly — every camera move, action beat (the
 * helicopter rope-slide, FPV drone shot, key toss), character/image reference,
 * and "Hard cut." stays as written — with only the quoted dialogue swapped for
 * the job's actual script. The LLM has latitude to decide exactly where the
 * dialogue breaks across the quote positions and to nudge the timestamp
 * boundaries (still summing to 15s) so the speech paces naturally; it must NOT
 * change anything else. A deterministic fallback (even word-count split into
 * the same templates) covers LLM failures/format drift.
 *
 * Both parts reference the SAME image set, ordered [...locationImages, ...avatarImages]
 * (location images first), matching the templates' #image1-4 = location /
 * #image5,#image7 = avatar convention.
 *
 * Unlike luxury-car-exit/home-tour, there is no separate B-roll/voiceover-overlay
 * layer — both clips already carry their own baked audio, so the final assembly
 * (ActionReelComposition) is just two clips back to back with a hard cut.
 */

async function callLLM(prompt) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY not configured");
  try {
    const result = await fal.subscribe("openrouter/router", {
      input: { model: "anthropic/claude-sonnet-4.6", prompt, max_tokens: 2048 },
      logs: false,
    });
    if (result?.data?.error) throw new Error(result.data.error);
    const output = (result?.data?.output ?? result?.output ?? "").toString().trim();
    if (output) return output;
    throw new Error("openrouter/router returned empty output");
  } catch (err) {
    console.warn(
      "[ActionReel] openrouter/router call failed, falling back to fal-ai/any-llm:",
      err.message,
    );
    const fallback = await fal.subscribe("fal-ai/any-llm", {
      input: { model: "anthropic/claude-3-5-haiku", prompt, max_tokens: 2048 },
    });
    return (fallback?.data?.output ?? fallback?.output ?? "").toString().trim();
  }
}

const DEFAULT_VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.3, speed: 1.0 };

function resolutionForQuality(quality) {
  // Always cap at 720p — pass through silently regardless of what the user picks
  return "720p";
}

async function generateAndUploadTTS(text, voiceId, userId, keyPrefix, language) {
  const { buffer, contentType, ext } = await synthesizeVoice({ text, voiceId, language });
  const key = buildUserKey(userId, "audio", ext, keyPrefix);
  return uploadToR2(buffer, key, contentType);
}

async function callSeedanceAndUpload(seedanceInput, userId, keyName, signal) {
  const result = await fal.subscribe(
    "bytedance/seedance-2.0/fast/reference-to-video",
    {
      input: seedanceInput,
      logs: false,
      ...(signal ? { abortSignal: signal } : {}),
    },
  );
  const falVideoUrl = result?.data?.video?.url;
  if (!falVideoUrl) throw new Error("Seedance returned no video URL");
  const videoRes = await fetch(falVideoUrl, signal ? { signal } : {});
  if (!videoRes.ok)
    throw new Error(`Failed to fetch Seedance video: ${videoRes.status}`);
  const videoBuf = Buffer.from(await videoRes.arrayBuffer());
  const key = buildUserKey(userId, "videos", "mp4", keyName);
  // Reopenable in /dashboard/edit — normalize keyframes so the Cut tool's
  // mid-clip seeks don't land on a black frame (see video-normalize.js).
  return uploadToR2(videoBuf, key, "video/mp4", { normalizeKeyframes: true });
}

// ── Fixed master templates — reproduced as-is except for the quoted dialogue ─
const MASTER_TEMPLATE_A = `A hyper-realistic, vertical (9:16) UGC-style action real estate indian accent vlog. Natural, dynamic lighting. It looks like a high-budget smartphone video. All spoken dialogue is delivered in a natural, indian accent conversational indian accent — casual everyday rhythm and pacing, like a real person talking to a friend, not overly enunciated or textbook-perfect.

[0:00 - 0:05] The video opens with an action-packed, fast-paced shot. A sleek black luxury helicopter hovers just above the ground. The female agent, (using #image7 for her facial features and #image5 for her black outfit), dramatically slides down a thick rope from the helicopter door. The moment her feet hit the ground, she immediately grabs the camera selfie-style. With her hair blowing wildly from the helicopter blades, she looks directly into the lens with intense high energy and says: "Kya aap bhi usi purani balcony se shehar ki bheed dekh kar bore ho gaye hain? Hello, main hoon Anvi..."

[0:05 - 0:08] Hard cut. The camera suddenly snaps to a fast, sweeping drone-style shot of a massive modern luxury villa exterior, matching exactly with #image1.

[0:08 - 0:11] Hard cut. A smooth, luxurious panning shot of an elegant dining setup with a striking mirror wall, exactly matching #image2.

[0:11 - 0:15] Hard cut. Back to the agent Anvi (#image7 and #image5) standing on the ground. The helicopter is still hovering in the background behind her. She smiles confidently, holding the camera selfie-style, and finishes her sentence: "...aapki real estate expert, aur aaj main aapko dikhane waali hoon aapka naya ultra-luxury ghar!" She stops speaking at exactly 13 seconds and spends the final 2 seconds simply holding a bright, confident smile at the camera as the wind blows her hair, ending the video naturally.`;

const MASTER_TEMPLATE_B = `A hyper-realistic, vertical (9:16) UGC-style high-energy real estate indian accent vlog. Dynamic, fast-paced cinematic editing. Natural interior lighting. All spoken dialogue is delivered in a natural, indian accent conversational indian accent — casual everyday rhythm and pacing, like a real person talking to a friend, not overly enunciated or textbook-perfect.

[0:00 - 0:03] The video opens with a fast, FPV drone-style sweeping shot moving towards the modern luxury villa exterior, matching exactly with #image1. The voiceover starts: "Zara sochiye... aapka apna ultra-luxury ghar..."

[0:03 - 0:06] Hard cut. A rapid, sweeping low-angle pan across the stunning, high-ceiling luxury loft space, matching #image3. The voiceover continues: "...premium living space..."

[0:06 - 0:08] Hard cut. A smooth, gliding tracking shot moving through the warm-toned living and dining area, matching #image4. The voiceover continues: "...shandaar designer decor..."

[0:08 - 0:10] Hard cut. A quick snap-pan landing perfectly on the elegant dining setup with the mirror wall, matching #image2. The voiceover says: "...aur ek perfect vibe. Hai na kamaal?"

[0:10 - 0:15] Hard cut. Back to the female agent, Anvi (using #image7 for her facial features and #image5 for her black outfit). She is standing confidently inside the luxury living room. Looking directly into the lens, she enthusiastically points her finger down toward the CTA link, and then playfully tosses a shiny set of house keys directly toward the camera lens. She says: "Toh intezaar kaisa? Neeche diye gaye link par abhi click karein aur apni VIP tour book karein!" She completely stops speaking at exactly 13 seconds, leaving the final 2 seconds showing her confident smile as the keys fly toward the viewer, ending the video naturally.`;

const TEMPLATE_MARKERS = {
  A: ["#image1", "#image2", "#image5", "#image7", "helicopter", "Hard cut"],
  B: ["#image1", "#image2", "#image3", "#image4", "#image5", "#image7", "keys", "Hard cut"],
};

function buildReproducePrompt({ masterTemplate, dialogue, partLabel }) {
  return `Reproduce the following video-generation prompt EXACTLY, with ONE change: replace all of the example spoken dialogue (the text inside quotation marks) with this actual dialogue, which must be spoken in full and unchanged: "${dialogue}"

You decide exactly where to split this dialogue across the quoted lines — it does not have to break at the same word as the example. You may also nudge the timestamp ranges in brackets (e.g. "[0:00 - 0:05]") so the pacing fits the new dialogue naturally — they must still start at 0:00, stay in the same order, and sum to 15 seconds total.

Do NOT change anything else: keep every camera movement, action description, character description, image reference (#image1, #image2, etc.), and "Hard cut." exactly as written below. Do not invent dialogue beyond the actual dialogue given above.

TEMPLATE TO REPRODUCE (${partLabel}):
"""
${masterTemplate}
"""

Return ONLY the finished prompt text — no markdown fences, no preamble, no explanation.`;
}

function isValidReproduction(text, markers) {
  if (!text || text.length < 200) return false;
  if (!/\[0:0/.test(text)) return false;
  return markers.every((m) => text.includes(m));
}

// ── Deterministic fallback — only used if the LLM reproduction fails validation ─
function splitWordsIntoChunks(text, n) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = Math.max(1, Math.ceil(words.length / n));
  const chunks = [];
  for (let i = 0; i < n; i++) {
    chunks.push(words.slice(i * chunkSize, (i + 1) * chunkSize).join(" "));
  }
  for (let i = 0; i < chunks.length; i++) {
    if (!chunks[i]) chunks[i] = chunks.slice(0, i).reverse().find(Boolean) || words.join(" ");
  }
  return chunks;
}

function fillTemplateAFallback(dialogue) {
  const [beat1, beat2] = splitWordsIntoChunks(dialogue, 2);
  return MASTER_TEMPLATE_A
    .replace(
      `"Kya aap bhi usi purani balcony se shehar ki bheed dekh kar bore ho gaye hain? Hello, main hoon Anvi..."`,
      `"${beat1}..."`,
    )
    .replace(
      `"...aapki real estate expert, aur aaj main aapko dikhane waali hoon aapka naya ultra-luxury ghar!"`,
      `"...${beat2}"`,
    );
}

function fillTemplateBFallback(dialogue) {
  const sentences = dialogue.split(/(?<=[.?!])\s+/).filter(Boolean);
  const cta = sentences.length > 1 ? sentences.pop() : "";
  const highlights = sentences.join(" ") || dialogue;
  const stripEnd = (s) => s.replace(/[.?!]+$/, "");
  const [beat1, beat2, beat3, beat4] = splitWordsIntoChunks(highlights, 4).map(stripEnd);
  return MASTER_TEMPLATE_B
    .replace(`"Zara sochiye... aapka apna ultra-luxury ghar..."`, `"${beat1}..."`)
    .replace(`"...premium living space..."`, `"...${beat2}..."`)
    .replace(`"...shandaar designer decor..."`, `"...${beat3}..."`)
    .replace(`"...aur ek perfect vibe. Hai na kamaal?"`, `"...${beat4}"`)
    .replace(
      `"Toh intezaar kaisa? Neeche diye gaye link par abhi click karein aur apni VIP tour book karein!"`,
      `"${cta || beat4}"`,
    );
}

async function reproduceTemplate({ template, markers, dialogue, partLabel, fallbackFn }) {
  try {
    const raw = await callLLM(
      buildReproducePrompt({ masterTemplate: template, dialogue, partLabel }),
    );
    const cleaned = raw
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/\n?```$/i, "")
      .replace(/^(here'?s the prompt:?|prompt:)\s*/i, "")
      .trim();
    if (isValidReproduction(cleaned, markers)) return cleaned;
    console.warn(
      `[ActionReel] ${partLabel} reproduction failed validation, using fallback template.`,
    );
  } catch (err) {
    console.warn(`[ActionReel] ${partLabel} reproduction LLM call failed:`, err.message);
  }
  return fallbackFn(dialogue);
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
    const quality = (formData.get("quality") || "auto").toString();
    const resolution = resolutionForQuality(quality);
    let voiceSettings = DEFAULT_VOICE_SETTINGS;
    try {
      const raw = formData.get("voiceSettings");
      if (raw) voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw.toString()) };
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
      `[ActionReel] Resolved ${avatarUrls.length} avatar URL(s):`,
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

    // User's own recorded/uploaded voice, if provided — bypasses ElevenLabs/
    // Sarvam TTS entirely and goes straight to Seedance as the audio_urls
    // reference for both parts (see Stage 2 below).
    let customVoiceBuf = null;
    let customVoiceMimeType = null;
    const customVoiceFile = formData.get("customVoiceFile");
    if (customVoiceFile && typeof customVoiceFile !== "string") {
      try {
        customVoiceBuf = Buffer.from(await customVoiceFile.arrayBuffer());
        customVoiceMimeType = customVoiceFile.type || "audio/webm";
      } catch (_) {}
    }

    if (avatarUrls.length === 0 && locationBufs.length === 0) {
      return NextResponse.json(
        { error: "At least avatar URLs or location images are required" },
        { status: 400 },
      );
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "action_reel_video",
      metadata: { endpoint: "/api/action-reel/generate-pipeline" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, {
        status: creditResult.status,
      });
    }
    debit = creditResult.debit;

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
            `areel-location-${i}`,
          );
          const url = await uploadToR2(cropped, key, "image/jpeg");
          if (url.startsWith("http")) locationR2Urls[i] = url;
        } catch (e) {
          console.warn(
            `[ActionReel] Failed to upload location image ${i}:`,
            e.message,
          );
        }
      }),
    );

    if (locationBufs.length > 0 && locationR2Urls.filter(Boolean).length === 0) {
      console.error(
        `[ActionReel] All ${locationBufs.length} location image upload(s) failed.`,
      );
    }

    // Upload the user's own voice recording/upload, if provided.
    let customVoiceUrl = null;
    if (customVoiceBuf) {
      try {
        const ext = extFromMime(customVoiceMimeType);
        const key = buildUserKey(userId, "audio", ext, "areel-custom-voice");
        customVoiceUrl = await uploadToR2(customVoiceBuf, key, customVoiceMimeType);
      } catch (e) {
        console.warn(
          "[ActionReel] Custom voice upload failed, falling back to TTS:",
          e.message,
        );
      }
    }

    // Capture the abort signal from the HTTP request — when the client
    // disconnects (abort button, navigate away), this fires automatically and
    // cancels in-flight fal.subscribe calls via the abortSignal option.
    const pipelineAbort = new AbortController();
    const pipelineSignal = pipelineAbort.signal;
    // Forward client disconnect → pipeline abort
    try { request.signal?.addEventListener("abort", () => pipelineAbort.abort()); } catch (_) {}

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

        async function persistJob(patch) {
          try {
            await SeedanceJob.updateOne({ jobId }, { $set: patch });
          } catch (e) {
            console.error("[ActionReel] Job persist failed:", e.message);
          }
        }

        const pingInterval = setInterval(() => send({ type: "ping" }), 3000);

        // Abort the stream's ping when the pipeline is cancelled
        pipelineSignal.addEventListener("abort", () => {
          clearInterval(pingInterval);
          try { controller.close(); } catch (_) {}
        });

        try {
          // ── Stage 1: 2-Part Script Split via LLM ──────────────────────────
          send({
            type: "script_splitting",
            message: "Splitting script into 2 parts…",
          });

          const splitPrompt = `You are a video script editor. Split this real estate ad script into exactly TWO parts for a fast-paced, high-energy vertical reel video.

RULES:
- Part 1 (HOOK ≤40 words): Opening hook. High energy, attention-grabbing, presenter speaks directly to camera. Must end at a natural sentence boundary.
- Part 2 (HIGHLIGHTS + CTA ≤45 words): Property highlights followed by whatever closing/call-to-action line already exists in the script. Do not invent a new CTA — keep the one in the script.
- Do NOT change, add, or remove any words — split at natural sentence boundaries only.
- Return ONLY valid JSON, no markdown: {"part1": "...", "part2": "..."}

SCRIPT:
${script}`;

          let part1 = "";
          let part2 = "";

          try {
            const splitRaw = await callLLM(splitPrompt);
            const jsonMatch = splitRaw
              .replace(/^```[a-z]*\n?/i, "")
              .replace(/\n?```$/i, "")
              .trim()
              .match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.part1 && parsed.part2) {
                part1 = parsed.part1.trim();
                part2 = parsed.part2.trim();
              }
            }
          } catch (splitErr) {
            console.warn(
              "[ActionReel] LLM split failed, using word-count split:",
              splitErr.message,
            );
          }

          if (!part1 || !part2) {
            const words = script.split(/\s+/);
            const mid = Math.ceil(words.length / 2);
            part1 = words.slice(0, mid).join(" ");
            part2 = words.slice(mid).join(" ");
          }

          const part1Words = part1.split(/\s+/).filter(Boolean).length;
          const part2Words = part2.split(/\s+/).filter(Boolean).length;

          // ── Language adaptation: bidirectional script conversion ───────────
          let part1_tts = part1,
            part2_tts = part2;
          let part1_roman = part1,
            part2_roman = part2;

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

          const nativeScriptRule = {
            hindi: "Convert every Hindi/Urdu word to Devanagari script.",
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
              send({
                type: "script_adapting",
                message: `Converting both parts to ${langName} for TTS…`,
              });
              try {
                const adaptPrompt = `You are a script localisation tool. The following ${langName} text is in Roman transliteration.

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
                const match = adaptRaw
                  .replace(/^```[a-z]*\n?/i, "")
                  .replace(/\n?```$/i, "")
                  .trim()
                  .match(/\{[\s\S]*\}/);
                if (match) {
                  const parsed = JSON.parse(match[0]);
                  const allValid =
                    parsed.part1?.trim().length > 5 &&
                    parsed.part2?.trim().length > 5;
                  if (allValid) {
                    part1_tts = parsed.part1.trim();
                    part2_tts = parsed.part2.trim();
                  } else {
                    console.warn(
                      "[ActionReel] Roman→native conversion incomplete — keeping both parts in Roman for consistency:",
                      parsed,
                    );
                  }
                }
              } catch (adaptErr) {
                console.warn(
                  "[ActionReel] Roman→native conversion failed:",
                  adaptErr.message,
                );
              }
            } else if (part1HasNativeScript) {
              send({
                type: "script_adapting",
                message: `Transliterating both parts to Roman for Seedance prompts…`,
              });
              try {
                const romanizePrompt = `Transliterate the following ${langName} texts from native script to Romanized Latin letters. Keep English brand names and numbers unchanged.
Return ONLY valid JSON (no markdown):
{"part1_roman": "...", "part2_roman": "..."}

TEXT 1:
${part1}

TEXT 2:
${part2}`;
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
                  if (parsed.part2_roman?.trim().length > 5)
                    part2_roman = parsed.part2_roman.trim();
                }
              } catch (romanErr) {
                console.warn(
                  "[ActionReel] Native→Roman transliteration failed:",
                  romanErr.message,
                );
              }
            }
          }

          send({ type: "script_split", part1, part2, part1Words, part2Words });
          await persistJob({ status: "splitting", part1, part2 });

          // ── Stage 2: Voice — the user's own recording (if provided) goes
          // straight to Seedance as the reference audio for BOTH parts,
          // bypassing ElevenLabs/Sarvam TTS entirely; the selected prebuilt
          // voice is ignored in that case. Otherwise, generate both TTS parts. ─
          let part1AudioUrl = null;
          let part2AudioUrl = null;

          if (customVoiceUrl) {
            send({
              type: "voice_generating",
              message: "Using your uploaded voice as the reference audio…",
            });
            part1AudioUrl = customVoiceUrl;
            part2AudioUrl = customVoiceUrl;
          } else {
            send({
              type: "voice_generating",
              message: "Generating voiceovers for both parts in parallel…",
            });

            const [p1TtsResult, p2TtsResult] = await Promise.allSettled([
              generateAndUploadTTS(part1_tts, voiceId, userId, "areel-part1-voice", language),
              generateAndUploadTTS(part2_tts, voiceId, userId, "areel-part2-voice", language),
            ]);

            if (p1TtsResult.status === "fulfilled") {
              part1AudioUrl = p1TtsResult.value;
            } else
              console.error(
                "[ActionReel] Part 1 TTS failed:",
                p1TtsResult.reason?.message,
              );
            if (p2TtsResult.status === "fulfilled") {
              part2AudioUrl = p2TtsResult.value;
            } else
              console.error(
                "[ActionReel] Part 2 TTS failed:",
                p2TtsResult.reason?.message,
              );
          }

          send({ type: "voice_all_ready", part1AudioUrl, part2AudioUrl });
          await persistJob({ status: "voices", part1AudioUrl, part2AudioUrl });

          // ── Stage 3: Reproduce both master templates with the real dialogue ─
          const validLocationUrls = locationR2Urls.filter(Boolean);
          if (validLocationUrls.length < 4 || avatarUrls.slice(0, 3).length < 3) {
            console.warn(
              `[ActionReel] Templates assume #image1-4 (location) + #image5/#image7 (avatar); ` +
              `got ${validLocationUrls.length} location + ${avatarUrls.slice(0, 3).length} avatar image(s). ` +
              `Seedance will ignore #imageN references with no matching image.`,
            );
          }

          const [part1Prompt, part2Prompt] = await Promise.all([
            reproduceTemplate({
              template: MASTER_TEMPLATE_A,
              markers: TEMPLATE_MARKERS.A,
              dialogue: part1_roman,
              partLabel: "Part 1 (hook)",
              fallbackFn: fillTemplateAFallback,
            }),
            reproduceTemplate({
              template: MASTER_TEMPLATE_B,
              markers: TEMPLATE_MARKERS.B,
              dialogue: part2_roman,
              partLabel: "Part 2 (highlights + CTA)",
              fallbackFn: fillTemplateBFallback,
            }),
          ]);

          send({
            type: "seedance_prompt_ready",
            part1Prompt,
            part2Prompt,
            message: "Both Seedance prompts ready.",
          });

          // ── Stage 4: Both Seedance calls in parallel ──────────────────────
          send({
            type: "seedance_generating",
            message: "Generating 2 videos in parallel via Seedance 2.0 (takes ~3–7 min)…",
          });
          await persistJob({ status: "seedance" });

          // Location images FIRST, then avatar images — matches the templates'
          // fixed #image1-4 (location) / #image5,#image7 (avatar) convention.
          const imageUrls = [...validLocationUrls, ...avatarUrls.slice(0, 3)];

          const part1Input = {
            prompt: part1Prompt,
            aspect_ratio: "9:16",
            duration: "15",
            resolution,
            generate_audio: true,
            ...(imageUrls.length > 0 && {
              image_urls: imageUrls,
              ...(part1AudioUrl && { audio_urls: [part1AudioUrl] }),
            }),
          };

          const part2Input = {
            prompt: part2Prompt,
            aspect_ratio: "9:16",
            duration: "15",
            resolution,
            generate_audio: true,
            ...(imageUrls.length > 0 && {
              image_urls: imageUrls,
              ...(part2AudioUrl && { audio_urls: [part2AudioUrl] }),
            }),
          };

          console.log(
            `[ActionReel] image_urls (${imageUrls.length}, location-first):`,
            imageUrls,
          );

          let part1VideoUrl = null;
          let part2VideoUrl = null;

          await Promise.allSettled([
            callSeedanceAndUpload(part1Input, userId, "areel-part1", pipelineSignal)
              .then((url) => {
                part1VideoUrl = url;
                console.log("[ActionReel] Part 1 video uploaded:", url);
                send({
                  type: "part1_video_done",
                  part1VideoUrl: url,
                  message: "Part 1 (hook) video ready!",
                });
                persistJob({ part1VideoUrl: url });
              })
              .catch((err) => {
                console.error("[ActionReel] Part 1 Seedance failed:", err.message);
                send({
                  type: "seedance_error",
                  message: `Part 1 video failed: ${err.message}`,
                });
              }),

            callSeedanceAndUpload(part2Input, userId, "areel-part2", pipelineSignal)
              .then((url) => {
                part2VideoUrl = url;
                console.log("[ActionReel] Part 2 video uploaded:", url);
                send({
                  type: "part2_video_done",
                  part2VideoUrl: url,
                  message: "Part 2 (highlights + CTA) video ready!",
                });
                persistJob({ part2VideoUrl: url });
              })
              .catch((err) => {
                console.error("[ActionReel] Part 2 Seedance failed:", err.message);
                send({
                  type: "seedance_error",
                  message: `Part 2 video failed: ${err.message}`,
                });
              }),
          ]);

          // If NEITHER succeeded, signal the frontend to go back to the script
          // step (fatal_error) then throw to trigger refund + job status update.
          if (!part1VideoUrl && !part2VideoUrl) {
            send({
              type: "fatal_error",
              message:
                "Both video generations failed — please check your images and try again.",
            });
            throw new Error(
              "Both Seedance video generations failed — see server logs for details.",
            );
          }

          // ── Stage 5: Save asset + finalize ────────────────────────────────
          send({ type: "uploading", message: "Saving to your Asset Library…" });

          const primaryUrl = part1VideoUrl || part2VideoUrl;
          if (primaryUrl) {
            try {
              await dbConnect();
              await Asset.create({
                userId,
                name: `Action Reel — ${new Date().toLocaleDateString()}`,
                url: primaryUrl,
                type: "clip",
                metadata: {
                  source: "action-reel",
                  part1VideoUrl,
                  part2VideoUrl,
                  part1AudioUrl,
                  part2AudioUrl,
                  language,
                },
              });
            } catch (dbErr) {
              console.error("[ActionReel] DB save error:", dbErr);
            }
          }

          send({
            type: "video_ready",
            part1VideoUrl,
            part2VideoUrl,
            message: "Both videos ready! Rendering final reel…",
          });
          await persistJob({ status: "done", part1VideoUrl, part2VideoUrl });

          send({ type: "done" });
          clearInterval(pingInterval);
          controller.close();
        } catch (err) {
          clearInterval(pingInterval);
          console.error("[ActionReel] Pipeline error:", err);
          await persistJob({
            status: "error",
            error: err.message || "Pipeline failed",
          });

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "action_reel_video",
              debit,
              metadata: {
                endpoint: "/api/action-reel/generate-pipeline",
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
    console.error("[ActionReel] Outer error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "action_reel_video",
        debit,
        metadata: {
          endpoint: "/api/action-reel/generate-pipeline",
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
