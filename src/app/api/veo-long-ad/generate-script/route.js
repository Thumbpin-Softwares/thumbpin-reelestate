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

async function callFal(prompt) {
  fal.config({ credentials: process.env.FAL_KEY });
  const result = await fal.subscribe("fal-ai/any-llm", {
    input: { model: "anthropic/claude-3-5-haiku", prompt, max_tokens: 4096 },
  });
  return (result?.data?.output ?? result?.output ?? "").toString().trim();
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

LANGUAGE: ${langInstruction}
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

EXAMPLE STYLE (M3M Opus ad — use as reference for energy and flow):
"When Gurgaon talks about ultra-exclusive living, M3M Opus sets a new benchmark…

Serving as the final, exclusive phase within the established M3M Merlin township, this standalone tower delivers low-density, Singaporean-style boutique luxury.

With 4-corner, 3-side open layouts, 270-degree views — every residence overlooks the city skyline and the Aravalli Hills…

Hurry! Inventory is limited. For a site visit, click the button below."

Write the script now. Return ONLY the spoken script text with no headers, no labels, no formatting.`;

    const rawScript = await callFal(prompt);
    if (!rawScript || rawScript.length < 50) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 502 });
    }

    // ── TTS normalization pass ───────────────────────────────────────────────
    const ttsPrompt = `You are a text-to-speech normalization expert. Convert the following real estate ad script into natural spoken text that a TTS engine will pronounce correctly.

RULES:
1. Write out ALL numbers as words: "₹2.5 Cr" → "two point five crore", "4 BHK" → "four BHK", "2,500 sqft" → "two thousand five hundred square feet", "270-degree" → "two seventy degree", "24/7" → "twenty four seven"
2. Expand ALL abbreviations: "sqft" → "square feet", "BR" → "bedroom", "yr" → "year", "yrs" → "years", "approx" → "approximately"
3. Remove currency symbols — write them as words: "₹" → nothing (just say the number and crore/lakh), "$" → "dollars"
4. Replace "…" with a period and line break. Replace " — " with a comma or period.
5. Keep proper nouns, project names, and location names exactly as-is (do not change spelling of names).
6. Keep the same language and tone — do NOT translate or rephrase content. Only fix pronunciation-unsafe characters and abbreviations.
7. Return ONLY the cleaned script text. No labels, no headers, no explanation.

SCRIPT:
${rawScript}`;

    let script = rawScript;
    try {
      const normalized = await callFal(ttsPrompt);
      if (normalized && normalized.length > 50) {
        script = normalized;
      }
    } catch (ttsErr) {
      console.warn("[VeoLongAd] TTS normalization failed, using raw script:", ttsErr.message);
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
