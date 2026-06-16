import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/site-view/generate-script
 *
 * Takes construction site / development Q&A answers and generates a full
 * site-visit video script (200–350 words) in the style of a real estate
 * developer / site-tour creator.
 *
 * Input (JSON):
 *   projectName, location, stage, plotSizes, price, highlights[], cta, language, tone
 *
 * Output (JSON):
 *   { success: true, script: string, wordCount: number, estimatedDuration: number }
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectName = "",
      location = "",
      stage = "",
      plotSizes = "",
      price = "",
      highlights = [],
      cta = "Book your site visit today",
      language = "english",
      tone = "professional",
    } = body;

    if (!projectName || !location) {
      return NextResponse.json(
        { error: "projectName and location are required" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const languageMap = {
      english: "English (Indian real-estate creator style)",
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
      professional: "confident, credible, developer-led, trust-building, data-driven",
      energetic: "fast-paced, exciting, hype energy, urgency-driven",
      aspirational: "vision-led, dream-investment, lifestyle upgrade, identity-based",
      casual: "friendly, conversational, approachable, relatable walkthrough",
      urgent: "FOMO-heavy, limited plots, act-now tone",
      luxury: "ultra-premium land, exclusive township, aspirational project",
      storytelling: "narrative journey, show the vision, emotional connection to the land",
    };

    const langInstruction = languageMap[language] || languageMap.english;
    const toneInstruction = toneMap[tone] || toneMap.professional;
    const highlightsList = Array.isArray(highlights) && highlights.length > 0
      ? highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "Prime location, developed infrastructure, clear title, strong appreciation potential";

    const prompt = `You are a world-class real estate scriptwriter specializing in construction site visit and land/plot development videos for the Indian market.

Write a complete, spoken site-visit video script for the following project. This script will be read aloud by a presenter walking through the actual development site (similar to a real estate creator's site tour reel on social media).

PROJECT DETAILS:
- Project Name: ${projectName}
- Location: ${location}
- Development Stage: ${stage || "Active development"}
- Plot Sizes / Configurations: ${plotSizes || "Various plot sizes available"}
- Price: ${price || "Competitive pricing"}
- Key Highlights / Infrastructure:
${highlightsList}
- Call-to-Action: ${cta}

LANGUAGE: ${langInstruction}
TONE: ${toneInstruction}

SCRIPT REQUIREMENTS:
1. Length: 200–350 words (speakable in 60–90 seconds at natural walking pace)
2. Structure: Hook (why this site is special) → Project overview → Location/connectivity → Infrastructure on ground → Plot details → Value/appreciation → Urgency → CTA
3. Write in SPOKEN, WALKING language — the presenter is physically on the site, pointing things out. Short punchy sentences, not formal prose.
4. Include natural energy of someone who is excited to show you around — "Look at this…", "And here's what I love…", "You won't believe…"
5. Use ellipsis (…) naturally for dramatic pauses and breath points
6. DO NOT include stage directions, timestamps, or any formatting — pure spoken text only
7. Ground it in physical reality — reference what the presenter can SEE on site (roads, plots, infrastructure, boundaries, signage)
8. End with a strong, clear call-to-action

EXAMPLE STYLE (site-visit tone — use as reference):
"We are standing right at the entrance of what's going to be one of the most talked-about townships in this region…

Look at that road. Already laid. Drainage done. Electricity poles up. This is not just a plot — this is a ready-to-build investment.

Forty-five minutes from the city centre. School within two kilometres. Commercial hub coming up right next door…

And plots starting at just forty lakhs. In this location. At this stage of development.

I'm telling you — come see this for yourself before the next phase is released."

Write the script now. Return ONLY the spoken script text with no headers, no labels, no formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const rawScript = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawScript || rawScript.length < 50) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 502 });
    }

    // TTS normalization pass
    const ttsPrompt = `You are a text-to-speech normalization expert. Convert the following real estate site-visit script into natural spoken text that a TTS engine will pronounce correctly.

RULES:
1. Write out ALL numbers as words: "40 lakhs" → "forty lakhs", "2 km" → "two kilometres", "45 mins" → "forty five minutes", "24/7" → "twenty four seven"
2. Expand ALL abbreviations: "sqft" → "square feet", "km" → "kilometres", "mins" → "minutes", "approx" → "approximately"
3. Remove currency symbols — write them as words: "₹" → nothing (just say the number and crore/lakh), "$" → "dollars"
4. Replace "…" with a period and line break. Replace " — " with a comma or period.
5. Keep proper nouns, project names, and location names exactly as-is.
6. Keep the same language and tone — do NOT translate or rephrase. Only fix pronunciation-unsafe characters and abbreviations.
7. Return ONLY the cleaned script text. No labels, no headers, no explanation.

SCRIPT:
${rawScript}`;

    let script = rawScript;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: ttsPrompt }] }],
      });
      const normalized = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (normalized && normalized.length > 50) {
        script = normalized;
      }
    } catch (ttsErr) {
      console.warn("[SiteView] TTS normalization failed, using raw script:", ttsErr.message);
    }

    const wordCount = script.split(/\s+/).length;

    return NextResponse.json({
      success: true,
      script,
      wordCount,
      estimatedDuration: Math.round((wordCount / 140) * 60),
    });
  } catch (error) {
    console.error("[SiteView] generate-script error:", error);
    return NextResponse.json(
      { error: error.message || "Script generation failed" },
      { status: 500 }
    );
  }
}
