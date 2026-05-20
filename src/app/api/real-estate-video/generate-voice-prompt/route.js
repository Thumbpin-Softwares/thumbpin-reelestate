import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/real-estate-video/generate-voice-prompt
 * Generate a hyper-detailed voice description for a real estate spokesperson.
 * Input: FormData with compositeImage (file) + script (string)
 * Output: { voicePrompt: string }
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
    const compositeFile = formData.get("compositeImage");
    const script = formData.get("script");
    const language = formData.get("language") || "hindi";

    if (!compositeFile || !script) {
      return NextResponse.json({ error: "compositeImage and script are required" }, { status: 400 });
    }

    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        data: buffer.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const compositeData = await fileToBase64(compositeFile);

    const languageGuides = {
      english: "Deliver the voice in clear Indian-English with a neutral, premium urban accent.",
      hindi: "Deliver the voice in natural Hindi with a polished Indian presentation style.",
      hinglish: "Deliver the voice in natural Hinglish with a casual but premium Indian urban feel.",
      marathi: "Deliver the voice in fluent Marathi with a warm Maharashtrian delivery.",
      tamil: "Deliver the voice in fluent Tamil with a natural South Indian delivery.",
      telugu: "Deliver the voice in fluent Telugu with a smooth, warm delivery.",
      kannada: "Deliver the voice in fluent Kannada with a calm, confident delivery.",
      malayalam: "Deliver the voice in fluent Malayalam with an elegant, natural delivery.",
      bengali: "Deliver the voice in fluent Bengali with a soft, expressive delivery.",
      gujarati: "Deliver the voice in fluent Gujarati with a bright, friendly delivery.",
      punjabi: "Deliver the voice in fluent Punjabi with a warm, energetic delivery.",
      urdu: "Deliver the voice in fluent Urdu with an elegant, expressive delivery.",
      odia: "Deliver the voice in fluent Odia with a smooth, natural delivery.",
    };

    const prompt = `Voice casting director for real estate video. Analyze the person in this image.\nScript they will speak: "${script}"\nLanguage/delivery: ${languageGuides[language] || languageGuides.hindi}\n\nReturn ONE paragraph, comma-separated, covering: gender + age range, specific accent, pitch variation, tone quality, emotional delivery arc (hook energy → smooth walkthrough → aspirational close), vocal expressiveness cues, pacing ~140 wpm, energy level, and recording quality (dry close-mic, zero reverb/echo/robotic artifacts, warm chest resonance, natural dynamic range, soft room tone only — no music/surround sound).\nReturn ONLY the paragraph. No headers, no explanations.`;

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: compositeData },
          ],
        },
      ],
    });

    let voicePrompt = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!voicePrompt) {
      return NextResponse.json({ error: "Failed to generate voice prompt" }, { status: 502 });
    }

    voicePrompt = voicePrompt.replace(/^["']|["']$/g, "");

    return NextResponse.json({ success: true, voicePrompt });
  } catch (error) {
    console.error("[RealEstateVideo] Generate voice prompt error:", error);
    return NextResponse.json({ error: error.message || "Voice prompt generation failed" }, { status: 500 });
  }
}
