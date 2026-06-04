import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/veo-long-ad/chunk-script
 *
 * Takes a full property script + reference images (location + avatar),
 * then uses Gemini to:
 *   1. Split the script into 8-second spoken chunks (~20–25 words each)
 *   2. Generate a cinematic Veo director prompt for EACH chunk
 *   3. Generate a master voice prompt for voice consistency
 *
 * Input (FormData):
 *   script: string
 *   language: string
 *   locationImages[]: File[] (1–5 images)
 *   avatarImages[]: File[] (1–5 images)
 *
 * Output (JSON):
 *   {
 *     chunks: Array<{
 *       index: number,
 *       text: string,
 *       estimatedSeconds: number,
 *       veoPrompt: string,
 *       cameraDirection: string,
 *     }>,
 *     masterVoicePrompt: string,
 *     totalChunks: number,
 *     totalEstimatedDuration: number,
 *   }
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
    const script = (formData.get("script") || "").toString().trim();
    const language = (formData.get("language") || "english").toString();

    if (!script || script.length < 20) {
      return NextResponse.json({ error: "script is required (min 20 chars)" }, { status: 400 });
    }

    // Collect location images
    const locationImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`locationImage_${i}`);
      if (file) locationImages.push(file);
    }
    // Fallback single
    if (locationImages.length === 0) {
      const single = formData.get("locationImage");
      if (single) locationImages.push(single);
    }

    // Collect avatar images
    const avatarImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`avatarImage_${i}`);
      if (file) avatarImages.push(file);
    }
    if (avatarImages.length === 0) {
      const single = formData.get("avatarImage");
      if (single) avatarImages.push(single);
    }

    async function fileToBase64(file) {
      const buf = Buffer.from(await file.arrayBuffer());
      return { data: buf.toString("base64"), mimeType: file.type || "image/jpeg" };
    }

    const locationDataArr = locationImages.length > 0
      ? await Promise.all(locationImages.slice(0, 4).map(fileToBase64))
      : [];
    const avatarDataArr = avatarImages.length > 0
      ? await Promise.all(avatarImages.slice(0, 2).map(fileToBase64))
      : [];

    const ai = new GoogleGenAI({ apiKey });

    const languageMap = {
      english: "English", hindi: "Hindi", hinglish: "Hinglish", marathi: "Marathi",
      tamil: "Tamil", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam",
      bengali: "Bengali", gujarati: "Gujarati", punjabi: "Punjabi", urdu: "Urdu", odia: "Odia",
    };
    const langName = languageMap[language] || "English";

    const MAX_CHUNKS = 3;

    const UGC_AESTHETICS = `QUALITY REQUIREMENTS: Ultra-realistic luxury real estate UGC. Maximum realism. Prioritize realistic lip synchronization over complex movement. Natural human behavior: natural blinking, natural facial expressions, natural breathing.
CAMERA: Single continuous gimbal shot, 35mm lens, slow smooth movement, natural handheld micro-movements.
NEGATIVE PROMPT (AVOID THESE STRICTLY): No robotic motion, no exaggerated gestures, no excessive head movement, no identity drift, no AI artifacts, no sudden camera cuts while speaking, no rushed speech, no background sound effects.`;

    const chunkingPrompt = `You are an expert AI video director specializing in ultra-realistic luxury real estate UGC.
        I have provided images of a real estate location and a person (avatar).

        Write a highly detailed, 3-part sequential video prompt for a Google Veo generation pipeline.
        The spoken language for the dialogue MUST be ${language}.
        CRUCIAL: For Indian languages, you MUST write the dialogue in ROMAN TRANSLITERATION (e.g., "Yeh property sach mein...").
        NARRATIVE ARC & TIMING RULES:
        - The video must feel like a continuous high-end luxury vlog with hard camera cuts only occurring between the 3 parts.
        - Cuts MUST ONLY happen when the avatar has completely finished speaking. Never cut mid-sentence.

        PART 1 (Arrival & Hook):
        - Visual: A luxury SUV is parked in front of the location. The avatar exits the vehicle naturally, closes the door, looks at the property with a small authentic smile, and walks 2-3 steps forward.
        - Audio: Avatar begins speaking slowly, introducing the property.
        PART 2 (The Balcony/Interior):
        - Visual: Start this prompt with the words "HARD CAMERA CUT:". The avatar is now standing at a balcony or a premium spot at the location.
        - Audio: Avatar speaks about the architecture and premium feel.
        PART 3 (Final CTA):
        - Visual: Start this prompt with the words "HARD CAMERA CUT:". The avatar is at one final beautiful spot in the location.
        - Audio: Delivers a warm, slow Call to Action.
         REQUIREMENTS FOR JSON OUTPUT:
        - "voice_profile": Define voice. State: "Voice direction: Female luxury real estate consultant, 22-25 years old. Warm, trustworthy, soft confidence. Speech speed 70% of normal pace. Speaking fluent ${language}. Clean voiceover ONLY. No background SFX."
        - "part1": Describe exact visual actions (car, stepping out) and EXACT dialogue in quotes. Append: "${UGC_AESTHETICS}"
        - "part2": Must start with "HARD CAMERA CUT: New perspective from the balcony." Include EXACT dialogue. Append: "MAINTAIN EXACT SAME PRESENTER IDENTITY. ${UGC_AESTHETICS}"
        - "part3": Must start with "HARD CAMERA CUT: Final location." Include EXACT dialogue. Append: "MAINTAIN EXACT SAME PRESENTER IDENTITY. ${UGC_AESTHETICS}"

        Output MUST be valid JSON with exact keys: "voice_profile", "part1", "part2", "part3". No markdown wrappers.`;

    const parts = [{ text: chunkingPrompt }];
    locationDataArr.forEach((d) => parts.push({ inlineData: d }));
    avatarDataArr.forEach((d) => parts.push({ inlineData: d }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts }],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "Failed to generate chunk prompts" }, { status: 502 });
    }

    // ── Parse the JSON response: { voice_profile, part1, part2, part3 } ────────
    let masterVoicePrompt = getDefaultVoicePrompt(language);
    let presenterDescription = "";
    const chunks = [];

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.voice_profile) masterVoicePrompt = parsed.voice_profile;
        [parsed.part1, parsed.part2, parsed.part3].filter(Boolean).forEach((prompt, i) => {
          chunks.push({
            index: i,
            text: "",
            veoPrompt: prompt,
            estimatedSeconds: 8,
            cameraDirection: "",
          });
        });
      } catch (_) {}
    }

    if (chunks.length === 0) {
      // Fallback: simple word-based chunking if parsing fails
      const words = script.split(/\s+/);
      const WORDS_PER_CHUNK = 22;
      let wordIdx = 0;
      let chunkIdx = 0;

      while (wordIdx < words.length && chunkIdx < MAX_CHUNKS) {
        const chunkWords = words.slice(wordIdx, wordIdx + WORDS_PER_CHUNK);
        const text = chunkWords.join(" ");
        chunks.push({
          index: chunkIdx,
          text,
          estimatedSeconds: 8,
          cameraDirection: chunkIdx === 0 ? "Fast zoom-in toward presenter at property gate" : "Cinematic wide shot with presenter walking",
          veoPrompt: buildFallbackVeoPrompt(text, chunkIdx, chunks.length, masterVoicePrompt, langName),
        });
        wordIdx += WORDS_PER_CHUNK;
        chunkIdx++;
      }
    }

    const totalEstimatedDuration = chunks.reduce((sum, c) => sum + (c.estimatedSeconds || 8), 0);

    return NextResponse.json({
      success: true,
      chunks,
      masterVoicePrompt,
      presenterDescription,
      totalChunks: chunks.length,
      totalEstimatedDuration,
    });
  } catch (error) {
    console.error("[VeoLongAd] chunk-script error:", error);
    return NextResponse.json(
      { error: error.message || "Chunk generation failed" },
      { status: 500 }
    );
  }
}

function getDefaultVoicePrompt(language = "english") {
  const accents = {
    english: "polished Indian-English accent with confident urban inflection",
    hindi: "natural North Indian Hindi with smooth warm delivery",
    kannada: "fluent Kannada with calm confident real-estate creator energy",
    tamil: "fluent Tamil with natural Chennai cadence and smooth delivery",
    telugu: "smooth Telugu with warm confident delivery",
    marathi: "fluent Marathi with warm Maharashtrian delivery",
  };
  const accent = accents[language] || accents.english;
  return `Female voice, age 28–35, ${accent}, warm medium-high pitch with natural variation, rich authoritative tone, real-estate creator delivery style — fast on highlights, softer on premium details, meaningful pauses. Pacing ~140 wpm. Recorded on dry close-mic, zero reverb, zero echo, zero noise, warm chest resonance, natural sibilance, natural dynamic range.`;
}

function buildFallbackVeoPrompt(text, index, total, voicePrompt, langName) {
  return `Ultra-realistic real estate showcase video, 9:16 portrait for Instagram Reels.

🗣️ DIALOGUE: "${text}"

🎥 CAMERA: ${index === 0 ? "Fast zoom-in toward presenter standing at property gate, dynamic energetic movement" : index === total - 1 ? "Final close-up push-in toward presenter, strong confident ending expression" : "Wide cinematic exterior shot, presenter walking in front of property facade"}

⚠️ RULES: Exterior shots ONLY (gate, front elevation, balcony). NO interior shots. Match reference images exactly. NO text or watermarks on screen.

VOICE: ${voicePrompt}
Language: ${langName}. Perfect lip-sync mandatory. Ultra-realistic cinematic quality. Golden hour luxury lighting.`;
}
