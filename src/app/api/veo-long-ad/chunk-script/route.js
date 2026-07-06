import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { hasSufficientCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/veo-long-ad/chunk-script
 *
 * Beat Planner: analyzes the property script and outputs a 3-act beat plan.
 * Uses fal.ai any-llm (FAL_KEY). Model is user-selectable from the UI.
 *
 * Act 1 — Avatar Intro (~18-20s): HOOK + AVATAR_INTRO + AVATAR_WALK
 * Act 2 — Ken Burns Property (~18-22s): PROPERTY_VISUAL × 3 + FEATURE_BURST
 * Act 3 — Avatar Outro (~16-20s): AVATAR_RETURN + INVENTORY_ALERT + CTA
 *
 * Beat types:
 *   HOOK           — avatar exits luxury car, walks to camera, 5-6s
 *   AVATAR_INTRO   — avatar standing at entrance, introduces property, 6-7s
 *   AVATAR_WALK    — avatar walks through lobby/key area with gestures, 5-6s
 *   PROPERTY_VISUAL— room Ken Burns shot, Sarvam voiceover, 4-6s
 *   FEATURE_BURST  — price/spec overlay + punchy narration, 3-4s
 *   AVATAR_RETURN  — avatar returns to frame, limited inventory message, 5-6s
 *   INVENTORY_ALERT— avatar leans in with urgency/scarcity, 4-5s
 *   CTA            — avatar extends hand, delivers contact CTA, 5-6s
 */

const MAX_BEATS = 10;
const MAX_AVATAR_BEATS = 6;

const DEFAULT_FAL_MODEL = "anthropic/claude-3-5-haiku";
const ALLOWED_FAL_MODELS = new Set([
  "anthropic/claude-3-5-haiku",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "meta-llama/llama-3.3-70b-instruct",
]);

async function callLLM(prompt, model = DEFAULT_FAL_MODEL) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not configured");

  fal.config({ credentials: falKey });
  const result = await fal.subscribe("fal-ai/any-llm", {
    input: { model, prompt, max_tokens: 4096 },
  });
  return (result?.data?.output ?? result?.output ?? "").toString().trim();
}


export async function POST(request) {
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

    // Read-only affordability check — this route lets the caller pick the LLM
    // model (up to claude-opus-4/gpt-4o) and retries up to 3x, but doesn't
    // charge credits itself; the actual veo-long-ad generate-pipeline debits/
    // refunds. This just blocks a 0-credit user from using it at all.
    const affordability = await hasSufficientCreditsForAction({
      userId: user._id.toString(),
      action: "real_estate_video",
    });
    if (!affordability.ok) {
      return NextResponse.json(affordability.payload, { status: affordability.status });
    }

    const formData = await request.formData();
    const script = (formData.get("script") || "").toString().trim();
    const language = (formData.get("language") || "english").toString();
    const rawModel = (formData.get("model") || "").toString().trim();
    const llmModel = ALLOWED_FAL_MODELS.has(rawModel) ? rawModel : DEFAULT_FAL_MODEL;

    if (!script || script.length < 20) {
      return NextResponse.json({ error: "script is required (min 20 chars)" }, { status: 400 });
    }

    const langMap = {
      english: "English", hindi: "Hindi", hinglish: "Hinglish", marathi: "Marathi",
      tamil: "Tamil", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam",
      bengali: "Bengali", gujarati: "Gujarati", punjabi: "Punjabi", urdu: "Urdu", odia: "Odia",
    };
    const langName = langMap[language] || "English";

    const beatPlanPrompt = `You are a senior Indian real estate Instagram reel director. Design a HYBRID BEAT PLAN for a 45-55 second vertical reel that follows this EXACT 3-act structure.

═══════════════════════════════════════════════════
ACT 1 — AVATAR INTRO  (beats 0-2, target 18-20 seconds)
Presenter is the star. Camera stays on avatar. Physics-based realistic movement.
═══════════════════════════════════════════════════

Beat 0 — HOOK (visual_type "avatar") — 5-6s
Presenter exits a luxury car (door already mid-swing, never manually opened) and walks toward camera. First line of narration hooks viewer instantly. Smooth cinematic push-in following the walk.

Beat 1 — AVATAR_INTRO (visual_type "avatar") — 6-7s
Presenter standing confidently just outside property entrance, addressing camera directly. Introduces key highlights — location, configuration, lifestyle. UGC creator energy. Static medium close-up, property façade behind.

Beat 2 — AVATAR_WALK (visual_type "avatar") — 5-6s
Presenter walks purposefully through grand entrance or lobby, gestures at surroundings. Highlights one or two wow features visible in the space. Tracking medium shot follows the walk.

═══════════════════════════════════════════════════
ACT 2 — KEN BURNS PROPERTY SHOWCASE  (beats 3-6, target 18-22 seconds)
No presenter. Property photos with Ken Burns animation. Sarvam voiceover describes each space.
═══════════════════════════════════════════════════

Beat 3 — PROPERTY_VISUAL (visual_type "property") — 4-6s — living room / main hall
Beat 4 — PROPERTY_VISUAL (visual_type "property") — 4-6s — master bedroom
Beat 5 — PROPERTY_VISUAL (visual_type "property") — 4-6s — kitchen, dining, or premium amenity
Beat 6 — FEATURE_BURST  (visual_type "property") — 3-4s — price / key spec with overlay

Each property beat: one room only, one slow camera movement, warm lighting, NO people.

═══════════════════════════════════════════════════
ACT 3 — AVATAR OUTRO  (beats 7-9, target 16-20 seconds)
Presenter returns with urgency. Limited inventory + contact CTA.
═══════════════════════════════════════════════════

Beat 7 — AVATAR_RETURN (visual_type "avatar") — 5-6s
Presenter walks back into frame from side or turns to camera with renewed energy. Limited inventory message — only X units left, scarcity. Medium close-up as they settle into frame.

Beat 8 — INVENTORY_ALERT (visual_type "avatar") — 4-5s
Presenter leans slightly toward camera, urgent expression, one raised finger for emphasis. Emphasises: prices going up, last few units, closing soon. Close-up with slight push-in.

Beat 9 — CTA (visual_type "avatar") — 5-6s
Presenter stops, extends open hand toward camera with warm confident smile. Clear call-to-action: site visit, call number, DM. Elegant property softly blurred behind.

═══════════════════════════════════════════════════
PHYSICS & MOVEMENT RULES for ALL AVATAR BEATS:
- Every step: natural weight shift — foot placement to shoulder sway physically realistic
- Clothing fabric has micro-movement responding to motion; hair settles naturally when stopping
- When presenter stops: realistic momentum carries body slightly forward before settling
- Camera: gimbal/Steadicam with very low damping — slight natural sway, authentic creator look
- NEVER describe voice, audio, or speech — Sarvam TTS handles audio separately
- Max 50 words per avatar veo_prompt
- Include at end of every avatar prompt: "Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait."
═══════════════════════════════════════════════════

VEO PROMPT FORMAT for property beats (max 35 words):
"[Room name with specific detail]. [One slow camera movement]. [Lighting mood]. 9:16 vertical. No people. No text. No music."

NARRATION RULES — voiceover spoken by ElevenLabs TTS at speed 1.0 (~2.5 words/sec) in ${langName}:

⚠️ STRICT TIMING: Each beat's narration must fit within its duration_seconds at 2.5 words/sec.
⚠️ STRICT TOTAL: All narration combined must NOT exceed 120 words. Count words before finalising.

Per-beat word budgets (HARD LIMITS — never exceed):
- HOOK (5s): 8-10 words — snappy one-liner, instant hook as presenter walks toward camera
- AVATAR_INTRO (6s): 12-15 words — property name, location, config, one standout USP
- AVATAR_WALK (5s): 10-13 words — 2 wow features, like talking to a friend mid-walk
- PROPERTY_VISUAL (5s each): 10-12 words — one room, one detail, natural not brochure
- FEATURE_BURST (3s): 6-8 words — price or spec fact, punchy
- AVATAR_RETURN (5s): 10-12 words — inventory warning, FOMO
- INVENTORY_ALERT (4s): 8-10 words — urgent scarcity, one sharp sentence
- CTA (5s): 10-12 words — clear action: call, site visit, DM, link in bio

- Pure spoken words only — no stage directions, no quotation marks
- Punctuate for natural spoken delivery: commas for breath pauses, em-dash (—) for dramatic beat, ellipsis (...) before a reveal, exclamation mark for energy
- Short punchy sentences land harder than long flowing ones — prefer impact over completeness

Write all narration in English — a dedicated translation pass converts to the target language after beat planning.

OVERLAY TEXT RULES:
- HOOK: property name or tagline (2-5 words)
- FEATURE_BURST overlay: price/sqft/config (max 5 words) e.g. "₹2.5 Cr Onwards"
- INVENTORY_ALERT overlay: scarcity text (max 4 words) e.g. "Only 3 Units Left"
- CTA overlay: action text (max 4 words) e.g. "Book Site Visit →"
- All other beats: overlay_text = null

OUTPUT: valid JSON only, no markdown fences, no extra text:
{
  "beats": [
    {
      "index": 0,
      "type": "HOOK",
      "duration_seconds": 5,
      "visual_type": "avatar",
      "veo_prompt": "Presenter already stepping out of white luxury SUV, door swinging open mid-motion, walks confidently toward camera with warm smile and brief upward glance at building. Smooth cinematic push-in following walk. Golden hour light. Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.",
      "overlay_text": "...",
      "narration": "...",
      "lipsync_expression": "friendly"
    },
    {
      "index": 1,
      "type": "AVATAR_INTRO",
      "duration_seconds": 6,
      "visual_type": "avatar",
      "veo_prompt": "Presenter standing confidently outside grand property entrance, addresses camera directly with genuine enthusiasm and open hand gestures. Static medium close-up, property façade visible behind. Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.",
      "overlay_text": null,
      "narration": "...",
      "lipsync_expression": "friendly"
    },
    {
      "index": 2,
      "type": "AVATAR_WALK",
      "duration_seconds": 5,
      "visual_type": "avatar",
      "veo_prompt": "Presenter walks through grand entrance lobby, turns to camera mid-stride with expressive hand gesture pointing at the space. Tracking medium shot follows walk, luxury interior visible. Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.",
      "overlay_text": null,
      "narration": "...",
      "lipsync_expression": "friendly"
    },
    {
      "index": 3,
      "type": "PROPERTY_VISUAL",
      "duration_seconds": 5,
      "visual_type": "property",
      "veo_prompt": "...",
      "overlay_text": null,
      "narration": "...",
      "lipsync_expression": null
    },
    {
      "index": 4,
      "type": "PROPERTY_VISUAL",
      "duration_seconds": 5,
      "visual_type": "property",
      "veo_prompt": "...",
      "overlay_text": null,
      "narration": "...",
      "lipsync_expression": null
    },
    {
      "index": 5,
      "type": "PROPERTY_VISUAL",
      "duration_seconds": 5,
      "visual_type": "property",
      "veo_prompt": "...",
      "overlay_text": null,
      "narration": "...",
      "lipsync_expression": null
    },
    {
      "index": 6,
      "type": "FEATURE_BURST",
      "duration_seconds": 3,
      "visual_type": "property",
      "veo_prompt": "...",
      "overlay_text": "₹X Cr Onwards",
      "narration": "...",
      "lipsync_expression": null
    },
    {
      "index": 7,
      "type": "AVATAR_RETURN",
      "duration_seconds": 5,
      "visual_type": "avatar",
      "veo_prompt": "Presenter walks back into frame from side, settles to face camera with renewed energy and slightly urgent expression. Medium close-up as body settles after entry. Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.",
      "overlay_text": null,
      "narration": "...",
      "lipsync_expression": "friendly"
    },
    {
      "index": 8,
      "type": "INVENTORY_ALERT",
      "duration_seconds": 4,
      "visual_type": "avatar",
      "veo_prompt": "Presenter leans slightly toward camera with focused urgent expression, raises one finger for emphasis. Slight push-in. Subtle fabric tension as body leans forward. Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.",
      "overlay_text": "Only X Units Left",
      "narration": "...",
      "lipsync_expression": "professional"
    },
    {
      "index": 9,
      "type": "CTA",
      "duration_seconds": 5,
      "visual_type": "avatar",
      "veo_prompt": "Presenter stops and turns directly to camera with warm confident smile, extends one open hand toward viewer. Body weight settles naturally, property softly blurred behind. Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.",
      "overlay_text": "Book Site Visit →",
      "narration": "...",
      "lipsync_expression": "professional"
    }
  ],
  "voice_profile": "Brief description of presenter voice style",
  "full_narration": "Complete spoken text from all beats with narration, in order",
  "total_duration": 53
}

PROPERTY SCRIPT TO PLAN:
---
${script}
---`;

    // Retry the beat plan up to 2 times if the LLM returns bad/incomplete output
    let beats = [];
    let voiceProfile = buildDefaultVoiceProfile(language);
    let fullNarration = script;

    for (let attempt = 0; attempt <= 2; attempt++) {
      let rawText;
      try {
        rawText = await callLLM(beatPlanPrompt, llmModel);
      } catch (llmErr) {
        console.warn(`[VeoLongAd] Beat plan LLM attempt ${attempt + 1} threw:`, llmErr.message);
        if (attempt === 2) throw llmErr;
        continue;
      }

      if (!rawText) {
        console.warn(`[VeoLongAd] Beat plan attempt ${attempt + 1} returned empty response`);
        continue;
      }

      const cleanText = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.beats) && parsed.beats.length > 0) {
            const candidate = parsed.beats.slice(0, MAX_BEATS).map((b, i) => ({
              index: i,
              type: b.type || "PROPERTY_VISUAL",
              duration_seconds: clamp(b.duration_seconds || 4, 2, 8),
              visual_type: b.visual_type || "property",
              veo_prompt: b.veo_prompt || null,
              overlay_text: b.overlay_text || null,
              narration: b.narration || null,
              lipsync_expression: b.lipsync_expression || "friendly",
            }));

            // Reject if more than 2 beats are missing narration — retry
            const missingNarration = candidate.filter((b) => !b.narration).length;
            if (missingNarration > 2) {
              console.warn(`[VeoLongAd] Beat plan attempt ${attempt + 1} had ${missingNarration} beats without narration — retrying`);
              continue;
            }

            beats = candidate;
            if (parsed.voice_profile) voiceProfile = parsed.voice_profile;
            if (parsed.full_narration) fullNarration = parsed.full_narration;
            break;
          }
        } catch (parseErr) {
          console.warn(`[VeoLongAd] Beat plan attempt ${attempt + 1} JSON parse failed:`, parseErr.message);
        }
      }
    }

    if (beats.length === 0) {
      return NextResponse.json({ error: "Beat plan generation failed after 3 attempts — try again" }, { status: 502 });
    }

    // Enforce max presenter beat limit — downgrade excess avatar beats to property
    let avatarCount = 0;
    beats = beats.map((b) => {
      if (b.visual_type === "avatar") {
        avatarCount++;
        if (avatarCount > MAX_AVATAR_BEATS) {
          return {
            ...b,
            visual_type: "property",
            type: "PROPERTY_VISUAL",
            veo_prompt: b.veo_prompt || "Luxury interior detail close-up. Slow push-in. Warm ambient light. 9:16 vertical. No people.",
          };
        }
      }
      return b;
    });

    // Fill missing veo_prompts with fallbacks; drop beats with no narration rather than fabricating
    beats = beats
      .map((b) => ({
        ...b,
        veo_prompt: b.visual_type === "property"
          ? (b.veo_prompt || buildFallbackVeoPrompt(b.type))
          : (b.veo_prompt || buildFallbackPresenterVeoPrompt(b.type)),
      }))
      .filter((b) => b.narration);

    // ── Translation pass: convert narrations to native script ────────────
    // Runs only when language is non-English. Dedicated focused LLM call so
    // translation doesn't compete with beat-structure instructions.
    if (language !== "english") {
      const SCRIPT_RULE = {
        hindi:     "Hindi words in Devanagari script, English brand/place names and numbers stay Roman. Example: \"यह apartment सिर्फ ₹2.4 Crore में — यह chance बार-बार नहीं आता!\"",
        hinglish:  "Hindi/Urdu words in Devanagari, English words stay Roman. Example: \"यह property Gurgaon की best locality में है — यहाँ की amenities बिल्कुल world-class हैं!\"",
        marathi:   "Full Marathi in Devanagari. English proper nouns stay Roman.",
        tamil:     "Full Tamil in Tamil script (தமிழ்). English proper nouns stay Roman.",
        telugu:    "Full Telugu in Telugu script (తెలుగు). English proper nouns stay Roman.",
        kannada:   "Full Kannada in Kannada script (ಕನ್ನಡ). English proper nouns stay Roman.",
        malayalam: "Full Malayalam in Malayalam script (മലയാളം). English proper nouns stay Roman.",
        bengali:   "Full Bengali in Bengali script (বাংলা). English proper nouns stay Roman.",
        gujarati:  "Full Gujarati in Gujarati script (ગુજરાતી). English proper nouns stay Roman.",
        punjabi:   "Full Punjabi in Gurmukhi script (ਪੰਜਾਬੀ). English proper nouns stay Roman.",
        urdu:      "Urdu words in Devanagari-friendly Urdu. English proper nouns stay Roman.",
      };
      const scriptRule = SCRIPT_RULE[language] || `Translate to ${langName} in its native script.`;

      const toTranslate = beats
        .filter((b) => b.narration)
        .map((b) => ({ index: b.index, text: b.narration }));

      if (toTranslate.length > 0) {
        try {
          const translationPrompt = `You are a professional Indian real estate copywriter. Translate these voiceover lines for Sarvam TTS.

RULE: ${scriptRule}
Keep the same energy, emotion, and approximate word count. Do NOT add or remove ideas.
Return ONLY a valid JSON array — no markdown, no extra text:
[{"index": 0, "text": "translated narration"}, ...]

TEXTS TO TRANSLATE:
${JSON.stringify(toTranslate)}`;

          const translRaw = await callLLM(translationPrompt, llmModel);
          const translClean = translRaw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          const translMatch = translClean.match(/\[[\s\S]*\]/);
          if (translMatch) {
            const translArr = JSON.parse(translMatch[0]);
            const translMap = Object.fromEntries(translArr.map((t) => [t.index, t.text]));
            beats = beats.map((b) =>
              translMap[b.index] !== undefined ? { ...b, narration: translMap[b.index] } : b
            );
            fullNarration = beats
              .filter((b) => b.narration)
              .map((b) => b.narration)
              .join(" ");
          }
        } catch (translErr) {
          console.warn("[VeoLongAd] Translation pass failed, using original narration:", translErr.message);
        }
      }
    }

    const totalDuration = beats.reduce((s, b) => s + (b.duration_seconds || 4), 0);

    if (!fullNarration || fullNarration === script) {
      const avatarLines = beats
        .filter((b) => b.visual_type === "avatar" && b.narration)
        .map((b) => b.narration);
      if (avatarLines.length > 0) fullNarration = avatarLines.join(" ");
    }

    const chunks = beats.map((b) => ({
      index: b.index,
      text: b.narration || b.overlay_text || `${b.type} — property visual`,
      estimatedSeconds: b.duration_seconds,
      veoPrompt: b.veo_prompt || "",
      cameraDirection: b.overlay_text || b.type,
      beatType: b.type,
      visualType: b.visual_type,
      overlayText: b.overlay_text,
      lipsyncExpression: b.lipsync_expression,
      narration: b.narration,
    }));

    return NextResponse.json({
      success: true,
      beats,
      voiceProfile,
      fullNarration,
      totalDuration,
      chunks,
      masterVoicePrompt: voiceProfile,
      presenterDescription: "",
      totalChunks: beats.length,
      totalEstimatedDuration: totalDuration,
    });
  } catch (error) {
    console.error("[VeoLongAd] chunk-script error:", error);
    return NextResponse.json(
      { error: error.message || "Beat planning failed" },
      { status: 500 }
    );
  }
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function buildDefaultVoiceProfile(language = "english") {
  return `Warm, confident Indian real estate creator speaking in ${language}. Direct to camera, authentic, conversational. Natural pauses, no performance voice.`;
}

function buildFallbackVeoPrompt(type) {
  const map = {
    PROPERTY_VISUAL: "Luxury living room interior, slow dolly push-in, warm ambient lighting. 9:16 vertical. No people.",
    FEATURE_BURST: "Premium property finishes close-up, shallow depth of field. 9:16 vertical. No people.",
  };
  return map[type] || "Luxury property interior. Slow cinematic push-in. Warm light. 9:16 vertical. No people.";
}

const PHYSICS_SUFFIX = "Natural physics: weighted walk, clothing micro-movement, hair settles. 9:16 vertical portrait.";

function buildFallbackPresenterVeoPrompt(type) {
  const map = {
    HOOK: `Presenter already stepping out of white luxury SUV, door swinging open mid-motion, walks confidently toward camera with warm smile and brief upward glance at building. Smooth cinematic push-in following walk. Golden hour warm light. ${PHYSICS_SUFFIX}`,
    AVATAR_INTRO: `Presenter standing confidently outside grand property entrance, addresses camera directly with genuine enthusiasm and open hand gestures. Static medium close-up, property façade visible behind. ${PHYSICS_SUFFIX}`,
    AVATAR_WALK: `Presenter walks through grand entrance lobby, turns to camera mid-stride with expressive hand gesture pointing at the space. Tracking medium shot follows walk, luxury interior visible. ${PHYSICS_SUFFIX}`,
    AVATAR_RETURN: `Presenter walks back into frame from side, settles to face camera with renewed energy and slightly urgent expression. Medium close-up as body settles after entry momentum. ${PHYSICS_SUFFIX}`,
    INVENTORY_ALERT: `Presenter leans slightly toward camera with focused urgent expression, raises one finger for emphasis. Slight push-in for tension. Subtle fabric tension as body leans forward. ${PHYSICS_SUFFIX}`,
    CTA: `Presenter stops and turns directly to camera with warm confident smile, extends one open hand toward viewer. Body weight settles naturally, property softly blurred behind. ${PHYSICS_SUFFIX}`,
    AVATAR_SEGMENT: `Presenter walks through bright property interior, turns naturally to camera mid-step with genuine excitement and expressive hand gestures. Tracking medium close-up, luxury space behind. ${PHYSICS_SUFFIX}`,
  };
  return map[type] || `Presenter walks through property, turns naturally to camera, speaks directly with energy and natural hand gestures. Medium close-up tracking shot. ${PHYSICS_SUFFIX}`;
}


