import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/veo-long-ad/generate-script
 *
 * Takes property Q&A answers and generates a full long-form property ad script
 * (200–350 words) in the style of a professional real-estate influencer.
 *
 * Input (JSON):
 *   propertyName, location, type, size, price, usps[], cta, language, tone
 *
 * Output (JSON):
 *   { success: true, script: string, wordCount: number }
 */

// Primary model is claude-sonnet-4.6 via openrouter/router — same model the
// action-reel pipeline's callLLM uses. The previously-exclusive fal-ai/any-llm
// + claude-3-5-haiku path is too weak a model to reliably follow this route's
// multi-constraint prompts (tone, structure, USPs, non-negotiable price all
// at once), so it's now only a fallback if openrouter/router errors out.
async function callFal(prompt, { temperature = 0.7, max_tokens = 4096 } = {}) {
  fal.config({ credentials: process.env.FAL_KEY });
  try {
    const result = await fal.subscribe("openrouter/router", {
      input: { model: "anthropic/claude-sonnet-4.6", prompt, max_tokens, temperature },
      logs: false,
    });
    if (result?.data?.error) throw new Error(result.data.error);
    const output = (result?.data?.output ?? result?.output ?? "").toString().trim();
    if (output) return output;
    throw new Error("openrouter/router returned empty output");
  } catch (err) {
    console.warn(
      "[VeoLongAd] openrouter/router call failed, falling back to fal-ai/any-llm:",
      err.message,
    );
    const fallback = await fal.subscribe("fal-ai/any-llm", {
      input: { model: "anthropic/claude-3-5-haiku", prompt, max_tokens, temperature },
    });
    return (fallback?.data?.output ?? fallback?.output ?? "").toString().trim();
  }
}

// LLM self-judge for "soft" gibberish that the regex heuristic above misses —
// plausible-looking but fabricated words (e.g. "zuhraat", "conoscibility",
// "vyavastha-sag-bhara") that aren't real words in any language. Regex can't
// catch these since they're normally-cased, normal-length tokens; only a
// language-aware judge can flag fabricated vocabulary.
async function judgeIsFluent(text, langInstruction) {
  const judgePrompt = `You are a strict ${langInstruction} language-fluency checker.

Read the following text and check ONLY for fabricated/non-existent words — words that are not real words in ${langInstruction} or English (invented-sounding words a native speaker would never recognize, e.g. "zuhraat", "conoscibility", "vyavastha-sag-bhara").

Do NOT flag normal proper nouns, brand names, or real English loanwords used in ${langInstruction}.

TEXT:
${text}

Reply with EXACTLY one word: VALID if there are no fabricated words, or INVALID if there is even one fabricated/non-existent word.`;
  try {
    const verdict = await callFal(judgePrompt, { temperature: 0 });
    return /^\s*VALID\b/i.test(verdict);
  } catch (_) {
    return true; // judge call failing shouldn't block the pipeline
  }
}

// Catches degenerate/hallucinated LLM output (e.g. "Mare-in_people ram eLo
// tem_weight st-bodyodor") that isn't real text in any language — observed
// when this small model is pushed to creatively write directly in a
// code-switched non-English language. Flags underscores, mid-word case
// switches, and absurdly long tokens as anomalies.
function looksLikeGibberish(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 10) return true;
  let suspicious = 0;
  for (const raw of words) {
    const w = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (!w) continue;
    if (/_/.test(w) || /[a-z][A-Z]/.test(w) || /[a-zA-Z]{16,}/.test(w)) suspicious++;
  }
  return suspicious / words.length > 0.05;
}

async function callFalWithRetry(prompt, validator, attempts = 2, callOpts = {}) {
  let last = "";
  for (let i = 0; i < attempts; i++) {
    last = await callFal(prompt, callOpts);
    if (await validator(last)) return last;
    console.warn(`[VeoLongAd] LLM output failed validation (attempt ${i + 1}/${attempts}):`, last.slice(0, 200));
  }
  return null; // exhausted retries without a valid result — caller must handle fallback
}

export async function POST(request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      propertyName = "",
      location = "",
      type = "",
      size = "",
      price = "",
      usps = [],
      cta = "Book a site visit",
      language = "english",
      tone = "luxury",
    } = body;

    if (!propertyName || !location) {
      return NextResponse.json(
        { error: "propertyName and location are required" },
        { status: 400 }
      );
    }

    const languageMap = {
      english: "English (Indian real-estate influencer style)",
      hindi: "Hindi (Roman transliteration, conversational urban Hindi)",
      hinglish: "Hinglish (natural Hindi + English mix, Roman script)",
      marathi: "Marathi (Roman transliteration, warm Maharashtrian style)",
      tamil: "Tamil (Roman transliteration, polished South Indian style)",
      telugu: "Telugu (Roman transliteration, smooth delivery)",
      kannada: "Kannada (Roman transliteration, confident style)",
      malayalam: "Malayalam (Roman transliteration, elegant delivery)",
      bengali: "Bengali (Roman transliteration, expressive style)",
      gujarati: "Gujarati (Roman transliteration, bright friendly tone)",
      punjabi: "Punjabi (Roman transliteration, warm energetic delivery)",
      urdu: "Urdu (Roman transliteration, elegant expressive style)",
      odia: "Odia (Roman transliteration, smooth conversational style)",
    };

    const toneMap = {
      luxury: "ultra-premium luxury, aspirational, exclusive, boutique feel",
      professional: "confident, credible, data-driven, trust-building",
      energetic: "fast-paced, exciting, urgency-driven, hype energy",
      casual: "friendly, conversational, approachable, relatable",
      storytelling: "narrative-driven, emotional journey, lifestyle-focused",
      urgent: "FOMO-heavy, limited inventory, act-now tone",
      aspirational: "dream-home feeling, lifestyle upgrade, identity-based",
    };

    const langInstruction = languageMap[language] || languageMap.english;
    const toneInstruction = toneMap[tone] || toneMap.luxury;
    const uspsList = Array.isArray(usps) && usps.length > 0
      ? usps.map((u, i) => `${i + 1}. ${u}`).join("\n")
      : "Premium location, modern design, world-class amenities";

    // Always write the creative copy in English first — this small model is
    // far more reliable in English than asked to simultaneously invent ad
    // copy AND code-switch into a non-English language; doing both at once
    // is what produced hallucinated gibberish mid-script in practice.
    // Non-English output is produced by a separate, simpler translation pass.
    const prompt = `You are a world-class real estate scriptwriter for luxury property video ads in India.

Write a complete, spoken real estate ad script for the following property. This script will be read aloud by a presenter in a video ad (similar to a social media real estate creator style).

PROPERTY DETAILS:
- Name: ${propertyName}
- Location: ${location}
- Type: ${type || "Luxury Residential"}
- Size/Configuration: ${size || "Premium layouts"}
- Price: ${price || "Premium pricing"}
- Key USPs / Features:
${uspsList}
- Call-to-Action: ${cta}

LANGUAGE: English (Indian real-estate influencer style)
TONE: ${toneInstruction}

SCRIPT REQUIREMENTS:
1. Length: 200–350 words (must be speakable in 60–90 seconds at natural pace)
2. Structure: Hook → Property intro → Location/connectivity → Key features → Amenities → Price/value → Urgency → CTA
3. Write in SPOKEN language — short punchy sentences, not formal prose
4. Include natural pauses implied through sentence breaks
5. Make it feel like a confident real-estate creator speaking to camera, not an AI
6. Use ellipsis (…) naturally for dramatic pauses where appropriate
7. DO NOT include stage directions, timestamps, or any formatting — pure spoken text only
8. End with a clear, compelling call-to-action
9. PRICE IS NON-NEGOTIABLE: if a price was given (${price || "none given"}), state that exact figure verbatim wherever the price is mentioned. Do NOT invent, round, discount, or substitute any other number. If no price was given, do not mention any specific price or discount figure at all.

EXAMPLE STYLE (M3M Opus ad — reference ONLY for pacing, energy, and structure; ignore any numbers in it):
"When Gurgaon talks about ultra-exclusive living, M3M Opus sets a new benchmark…

Serving as the final, exclusive phase within the established M3M Merlin township, this standalone tower delivers low-density, Singaporean-style boutique luxury.

With 4-corner, 3-side open layouts, 270-degree views — every residence overlooks the city skyline and the Aravalli Hills…

Hurry! Inventory is limited. For a site visit, click the button below."

Write the script now, using the exact price given. Return ONLY the spoken script text with no headers, no labels, no formatting.`;

    const rawScript = await callFalWithRetry(
      prompt,
      (t) => Boolean(t && t.length >= 50 && !looksLikeGibberish(t))
    );
    if (!rawScript) {
      return NextResponse.json({ error: "Failed to generate a coherent script — please try again" }, { status: 502 });
    }

    // ── Translation pass (only if target language isn't English) ─────────────
    let creativeScript = rawScript;
    if (language !== "english") {
      const translatePrompt = `You are a professional translator for spoken ad scripts. Translate the following English real estate ad script into natural, conversational ${langInstruction}.

RULES:
1. Translate idiomatically — make it sound like a native speaker delivering the ad, not a literal word-for-word translation.
2. Keep ALL numbers, prices, percentages, project names, brand names, and English technical terms (e.g. "BHK", "sqft") unchanged — do not translate or alter them.
3. Preserve the structure, meaning, tone, and the exact price figure from the original — do not add, remove, or invent content.
4. Return ONLY the translated script text. No labels, no headers, no explanation, no commentary about the translation.

ENGLISH SCRIPT:
${rawScript}`;

      const translated = await callFalWithRetry(
        translatePrompt,
        async (t) => {
          if (!t || t.length < 50 || looksLikeGibberish(t)) return false;
          return judgeIsFluent(t, langInstruction);
        },
        3,
        { temperature: 0.3 } // lower temperature for translation fidelity — creativity isn't needed here, accuracy is
      );
      if (translated) {
        creativeScript = translated;
      } else {
        console.warn("[VeoLongAd] Translation failed validation after retries — falling back to English script.");
      }
    }

    // ── TTS normalization pass ───────────────────────────────────────────────
    const isEnglishScript = language === "english";
    const numberWordExample = isEnglishScript
      ? `"₹2.5 Cr" → "two point five crore", "4 BHK" → "four BHK", "2,500 sqft" → "two thousand five hundred square feet", "270-degree" → "two seventy degree", "24/7" → "twenty four seven"`
      : `write the number words themselves in ${langInstruction}, not English — e.g. for Hindi/Hinglish, "4000 sqft" → "chaar hazaar square feet" (NOT "four thousand" or "char thousand" — never mix a ${langInstruction} number word with an English one, or vice versa, within the same number)`;
    const ttsPrompt = `You are a text-to-speech normalization expert. Convert the following real estate ad script into natural spoken text that a TTS engine will pronounce correctly.

RULES:
1. Write out ALL numbers as words, fully and consistently in the script's own language: ${numberWordExample}. English brand/technical terms like "BHK" or "sqft" may stay in English even inside an otherwise non-English number phrase, but the number word itself (one/two/four/thousand/hazaar/etc.) must be entirely in one language — never split a single number across two languages.
2. Expand ALL abbreviations: "sqft" → "square feet", "BR" → "bedroom", "yr" → "year", "yrs" → "years", "approx" → "approximately"
3. Remove currency symbols — write them as words: "₹" → nothing (just say the number and crore/lakh), "$" → "dollars"
4. KEEP every "…" exactly as-is — it is a soft dramatic pause within continuous flowing speech, not a sentence break. Do NOT convert it into a period or a new sentence; ElevenLabs pronounces "…" natively as a brief pause without a full stop. Only replace " — " with a comma (never a period, to avoid adding unintended hard stops).
5. Keep proper nouns, project names, and location names exactly as-is (do not change spelling of names).
6. Keep the same language and tone — do NOT translate or rephrase content. Only fix pronunciation-unsafe characters and abbreviations.
7. Return ONLY the cleaned script text. No labels, no headers, no explanation.

SCRIPT:
${creativeScript}`;

    // Guards against a normalization pass that returns meta-commentary
    // ("I realized the previous response...") or hallucinated word-salad
    // instead of cleaned script text — both have been observed in practice.
    const META_COMMENTARY_RE = /\b(I realized|previous response|here is the (revised|updated)|as an AI|note that (some|the) text|normalized according to)\b/i;
    const creativeWordCount = creativeScript.split(/\s+/).filter(Boolean).length;
    async function isValidNormalization(text) {
      if (!text || text.length < 50) return false;
      if (META_COMMENTARY_RE.test(text)) return false;
      if (looksLikeGibberish(text)) return false;
      const wc = text.split(/\s+/).filter(Boolean).length;
      // Pronunciation expansion can grow word count somewhat, but a normalization
      // pass should never wildly shrink or balloon the script.
      if (wc < creativeWordCount * 0.7 || wc > creativeWordCount * 1.8) return false;
      if (!isEnglishScript) return judgeIsFluent(text, langInstruction);
      return true;
    }

    let script = creativeScript;
    try {
      const normalized = await callFal(ttsPrompt, { temperature: 0.3 });
      if (await isValidNormalization(normalized)) {
        script = normalized;
      } else if (normalized) {
        console.warn("[VeoLongAd] TTS normalization output failed validation, using creative script:", normalized.slice(0, 200));
      }
    } catch (ttsErr) {
      console.warn("[VeoLongAd] TTS normalization failed, using creative script:", ttsErr.message);
    }

    const wordCount = script.split(/\s+/).length;

    return NextResponse.json({
      success: true,
      script,
      wordCount,
      estimatedDuration: Math.round((wordCount / 140) * 60),
    });
  } catch (error) {
    console.error("[VeoLongAd] generate-script error:", error);
    return NextResponse.json(
      { error: error.message || "Script generation failed" },
      { status: 500 }
    );
  }
}
