import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/real-estate-video/generate-script
 * Generate real estate spokesperson scripts with strong hooks.
 * Supports single and batch mode (multiple properties).
 *
 * Single: compositeImage + propertyImage + language + tone → { script }
 * Batch:  compositeImage_0..N + propertyImage_0..N + compositeCount + language + tone → { scripts: [] }
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

    const formData = await request.formData();
    const language = formData.get("language") || "english";
    const tone = formData.get("tone") || "professional";
    const allowEmotionTags = formData.get("allowEmotionTags") === "true";
    const location = formData.get("location") || "";
    const propertyType = formData.get("propertyType") || "";
    const price = formData.get("price") || "";
    const bedrooms = formData.get("bedrooms") || "";
    const bathrooms = formData.get("bathrooms") || "";
    const area = formData.get("area") || "";
    const keyFeatures = formData.get("keyFeatures") || "";
    const amenities = formData.get("amenities") || "";
    const compositeCount = parseInt(formData.get("compositeCount")) || 0;

    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        data: buffer.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    const languageInstructions = {
      english: "Write the script in natural, conversational English.",
      hindi: "Write the script in natural, conversational Hindi (Devanagari script).",
      hinglish: "Write the script in Hinglish — a natural mix of Hindi and English words as spoken casually in urban India. Use Roman script.",
    };
    const langInstruction = languageInstructions[language] || languageInstructions.english;

    const emotionTagInstruction = allowEmotionTags
      ? "You may insert emotion tags like {{happy}}, {{sad}}, {{excited}}, {{calm}} inline before the phrase they affect. Keep tags exactly as written."
      : "Do NOT include any emotion tags or special markup.";

    const briefLines = [
      location && `Location: ${location}`,
      propertyType && `Property type: ${propertyType}`,
      price && `Price: ${price}`,
      bedrooms && `Bedrooms: ${bedrooms}`,
      bathrooms && `Bathrooms: ${bathrooms}`,
      area && `Area/size: ${area}`,
      keyFeatures && `Key features: ${keyFeatures}`,
      amenities && `Amenities: ${amenities}`,
    ].filter(Boolean);
    const briefBlock = briefLines.length ? `\n\nPROPERTY BRIEF:\n${briefLines.join("\n")}` : "";

    const RE_SCRIPT_PROMPT_BASE = `You are an expert real estate video script writer who creates VIRAL property showcase scripts for Instagram Reels and YouTube Shorts.

Your scripts must HOOK viewers in the first 2 seconds and make them WANT this property. Think like the best real estate influencers — aspirational, exciting, visual.

HOOK EXAMPLES (use these styles, create your own):
- "Imagine waking up to THIS view every morning..."
- "This 3BHK in Gurgaon just changed the game."
- "₹85 lakhs for THIS? Let me show you..."
- "I found the most STUNNING apartment in Sector 49..."
- "Wait till you see the master bedroom..."
- "This is what ₹1.2 cr buys you in 2025..."
- "POV: You just walked into your dream home."

REQUIREMENTS:
- Maximum 25-30 words (must fit in 8 seconds of natural speech)
- MUST start with a powerful, scroll-stopping hook (first 2-3 seconds)
- Describe what makes THIS specific space special (reference what you SEE in the image)
- End with curiosity or soft CTA ("Would you live here?", "DM for details", "Link in bio")
- Tone: ${tone} — confident, aspirational, but genuine
- ${langInstruction}
- Sound like a REAL real estate creator, NOT a formal listing description
- ${emotionTagInstruction}
- Do NOT include stage directions, emojis, or any other formatting — just spoken words
${briefBlock}

Return ONLY the script text, nothing else.`;

    // ── BATCH MODE ──────────────────────────────────────────────────────────
    if (compositeCount > 1) {
      const compositeFiles = [];
      const propertyFiles = [];
      for (let i = 0; i < compositeCount; i++) {
        const c = formData.get(`compositeImage_${i}`);
        const p = formData.get(`propertyImage_${i}`);
        if (c) compositeFiles.push(c);
        if (p) propertyFiles.push(p);
      }

      if (compositeFiles.length < 2) {
        return NextResponse.json({ error: "Batch mode requires at least 2 composite images" }, { status: 400 });
      }

      const compositeDataArr = await Promise.all(compositeFiles.map(fileToBase64));
      const propertyDataArr = await Promise.all(propertyFiles.map(fileToBase64));

      const batchPrompt = `${RE_SCRIPT_PROMPT_BASE}

You are given ${compositeDataArr.length} different composite images — each shows the SAME person presenting DIFFERENT properties/rooms/spaces. You also have the original property images.

Write a SEPARATE 8-second spoken script for EACH property. Each script should:
1. Reference what's visible in THAT specific space (room size, view, lighting, features)
2. Have a UNIQUE hook that matches that property's vibe
3. Work as a standalone video but also feel cohesive as a series

Return your response as valid JSON ONLY — an array of strings:
["script for property 1", "script for property 2", ...]`;

      const parts = [
        { text: batchPrompt },
        ...compositeDataArr.map((d) => ({ inlineData: d })),
        ...propertyDataArr.map((d) => ({ inlineData: d })),
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
      });

      const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) {
        return NextResponse.json({ error: "Failed to generate scripts" }, { status: 502 });
      }

      let scripts;
      try {
        const jsonStr = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        scripts = JSON.parse(jsonStr);
      } catch {
        scripts = rawText.split("\n").filter((s) => s.trim().length > 10).slice(0, compositeDataArr.length);
      }

      return NextResponse.json({ success: true, scripts });
    }

    // ── SINGLE MODE ─────────────────────────────────────────────────────────
    const compositeFile = formData.get("compositeImage");
    const propertyFile = formData.get("propertyImage");
    const hasBrief = !!(location || propertyType || price || bedrooms || bathrooms || area || keyFeatures || amenities);

    if (!compositeFile && !propertyFile && !hasBrief) {
      return NextResponse.json(
        { error: "Provide a compositeImage, propertyImage, or property brief fields" },
        { status: 400 }
      );
    }

    const parts = [{
      text: RE_SCRIPT_PROMPT_BASE + "\n\nIf provided, use the images and property brief to write one 8-second script."
    }];

    if (compositeFile) {
      const compositeData = await fileToBase64(compositeFile);
      parts.push({ inlineData: compositeData });
    }
    if (propertyFile) parts.push({ inlineData: await fileToBase64(propertyFile) });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
    });

    const scriptText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!scriptText) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 502 });
    }

    return NextResponse.json({ success: true, script: scriptText });
  } catch (error) {
    console.error("[RealEstateVideo] Generate script error:", error);
    return NextResponse.json({ error: error.message || "Script generation failed" }, { status: 500 });
  }
}
