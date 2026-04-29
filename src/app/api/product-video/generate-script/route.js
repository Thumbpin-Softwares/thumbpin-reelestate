import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/product-video/generate-script
 * Generate concise 8-second product scripts using Gemini text + vision.
 * Supports single mode (1 composite) and batch mode (multiple composites).
 *
 * Single mode:
 *   Input: FormData with compositeImage (file) + productImage (file) + language + tone
 *   Output: { script: string }
 *
 * Batch mode:
 *   Input: FormData with compositeImage_0, compositeImage_1, ... + productImage + compositeCount + language + tone
 *   Output: { scripts: [string] }
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
    const productFile = formData.get("productImage");
    const language = formData.get("language") || "english";
    const tone = formData.get("tone") || "friendly";
    const allowEmotionTags = formData.get("allowEmotionTags") === "true";
    const compositeCount = parseInt(formData.get("compositeCount")) || 0;

    if (!productFile) {
      return NextResponse.json({ error: "productImage is required" }, { status: 400 });
    }

    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        data: buffer.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const productData = await fileToBase64(productFile);
    const ai = new GoogleGenAI({ apiKey });

    const languageInstructions = {
      english: "Write the script in natural, conversational English.",
      hindi: "Write the script in natural, conversational Hindi (Devanagari script).",
      hinglish: "Write the script in Hinglish — a natural mix of Hindi and English words as spoken casually in urban India. Use Roman script.",
    };
    const langInstruction = languageInstructions[language] || languageInstructions.english;

    // ── BATCH MODE ──────────────────────────────────────────────────────────
    if (compositeCount > 1) {
      const compositeFiles = [];
      for (let i = 0; i < compositeCount; i++) {
        const f = formData.get(`compositeImage_${i}`);
        if (f) compositeFiles.push(f);
      }

      if (compositeFiles.length < 2) {
        return NextResponse.json({ error: "Batch mode requires at least 2 composite images" }, { status: 400 });
      }

      const compositeDataArr = await Promise.all(compositeFiles.map(fileToBase64));

      // Build batch prompt — Gemini sees all composites + product at once
      const emotionTagInstruction = allowEmotionTags
        ? "You may insert emotion tags like {{happy}}, {{sad}}, {{excited}}, {{calm}} inline before the phrase they affect. Keep tags exactly as written."
        : "Do NOT include any emotion tags or special markup.";

      const batchPrompt = `You are an expert UGC (User Generated Content) script writer.

You are given ${compositeDataArr.length} different composite images — each shows the SAME person presenting the SAME product but in DIFFERENT poses, actions, or camera angles. You also have a close-up of the product itself.

Write a SEPARATE 8-second spoken script for EACH composite image. Each script should match what's happening in THAT specific frame — if the person is holding the product up, the script should address that action; if they're applying it, the script should narrate that moment.

The scripts should work as a cohesive series (like 3 takes of the same product review), but each must be UNIQUE and match its composite's energy.

REQUIREMENTS FOR EACH SCRIPT:
- Maximum 25-30 words (must fit in 8 seconds of natural speech)
- Start with an attention-grabbing hook
- Match the action/pose visible in that specific composite
- End with a soft call-to-action
- Tone: ${tone}
- ${langInstruction}
- Natural UGC creator language — like talking to their phone camera
- Natural UGC creator language — like talking to their phone camera
- ${emotionTagInstruction}
- Do NOT include stage directions, emojis, or any other formatting

Return your response as valid JSON ONLY — an array of strings, one per composite in order:
["script for image 1", "script for image 2", ...]

Return ONLY the JSON array, nothing else.`;

      const parts = [
        { text: batchPrompt },
        ...compositeDataArr.map((d) => ({ inlineData: d })),
        { inlineData: productData },
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
        // Fallback: split by newlines or return raw
        scripts = rawText.split("\n").filter((s) => s.trim().length > 10).slice(0, compositeDataArr.length);
      }

      return NextResponse.json({ success: true, scripts });
    }

    // ── SINGLE MODE ─────────────────────────────────────────────────────────
    const compositeFile = formData.get("compositeImage");
    if (!compositeFile) {
      return NextResponse.json({ error: "compositeImage is required" }, { status: 400 });
    }

    const compositeData = await fileToBase64(compositeFile);

    const emotionTagInstruction = allowEmotionTags
      ? "You may insert emotion tags like {{happy}}, {{sad}}, {{excited}}, {{calm}} inline before the phrase they affect. Keep tags exactly as written."
      : "Do NOT include any emotion tags or special markup.";

    const prompt = `You are an expert UGC (User Generated Content) script writer.

Look at these two images:
1. A person holding/presenting a product (the composite image)
2. The product itself (close-up)

Write a SHORT spoken script that this person would say while presenting this product on camera. The script is for an 8-second video.

REQUIREMENTS:
- Maximum 25-30 words (this is critical — it must fit in 8 seconds of natural speech)
- Start with an attention-grabbing hook (1-2 words)
- Mention what the product does or why it's great
- End with a soft call-to-action
- Tone: ${tone}
- ${langInstruction}
- Make it sound natural — like a real person talking to their phone camera, NOT scripted or salesy
- Make it sound natural — like a real person talking to their phone camera, NOT scripted or salesy
- ${emotionTagInstruction}
- Do NOT include stage directions, emojis, or any other formatting — just the spoken words

Return ONLY the script text, nothing else.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: compositeData },
            { inlineData: productData },
          ],
        },
      ],
    });

    const scriptText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!scriptText) {
      return NextResponse.json({ error: "Failed to generate script" }, { status: 502 });
    }

    return NextResponse.json({ success: true, script: scriptText });
  } catch (error) {
    console.error("[ProductVideo] Generate script error:", error);
    return NextResponse.json({ error: error.message || "Script generation failed" }, { status: 500 });
  }
}
