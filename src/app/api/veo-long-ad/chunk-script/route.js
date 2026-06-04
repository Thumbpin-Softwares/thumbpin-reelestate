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

    const MAX_CHUNKS = 5;

    const UGC_AESTHETICS = `QUALITY REQUIREMENTS: Ultra-realistic luxury real estate UGC. Maximum realism. Prioritize realistic lip synchronization over complex movement. Natural human behavior: natural blinking, natural facial expressions, natural breathing. Soft natural ambient sound of the environment only.
CAMERA: Single continuous gimbal shot, 35mm lens, slow smooth movement, natural handheld micro-movements.
NEGATIVE PROMPT: No robotic motion, no exaggerated gestures, no excessive head movement, no identity drift, no AI artifacts.`;

    const chunkingPrompt = `You are an expert AI video director for ultra-realistic luxury real estate UGC.
        I have provided images of a real estate property and a presenter (avatar), plus a script below.

        STEP 1 — READ THE SCRIPT AND DECIDE HOW MANY PARTS ARE NEEDED:
        Do NOT default to a fixed number. Analyze the script's natural story beats:
        - Short script (1 main message): 2 parts
        - Medium script (location + 1-2 features): 3 parts
        - Full script (arrival + design + amenities + CTA): 4-5 parts
        Maximum is ${MAX_CHUNKS} parts. Minimum is 2. Choose the smallest number that covers the full script naturally.

        STEP 2 — TIMING RULE (CRITICAL):
        Each part is ONE continuous video clip. A real person speaking at a calm natural pace delivers ~2 words per second.
        Count your dialogue words and assign duration_seconds accordingly:
        - 8-10 words → duration_seconds: 6
        - 11-14 words → duration_seconds: 8
        Never assign more than 8 seconds. Never assign less than 6 seconds.
        DIALOGUE MUST BE MAX 14 WORDS PER PART. Count every word. Cut if over.
        IMPORTANT: The dialogue must end at least 1 second before the clip ends — leave a natural breath/pause at the end so cuts feel clean.

        STEP 3 — ONE ACTION PER PART:
        - Each part has ONE physical action only. The avatar is mostly still while speaking.
        - Never stack multiple actions. Never use "HARD CAMERA CUT" or any cut/transition language.

        SCENE STRUCTURE:
        - First part (SUV arrival): A luxury SUV is already parked, door already open. The avatar is mid-exit — one leg out, stepping onto the ground. She straightens up and pauses, looking at the property. That is the only action. She does NOT close the door, does NOT walk, does NOT gesture. She simply steps out and pauses.
        - Middle parts: Avatar standing still at different spots (property entrance, balcony, key amenity). ONE still spot per part.
        - Last part: Avatar faces camera directly, standing still, warm smile, delivers the CTA.

        OUTFIT CONSISTENCY RULE (critical — read carefully):
        - In part 1's prompt, describe a specific outfit for the avatar: e.g., "She wears a fitted ivory blazer, white top, minimal gold jewellery, hair down."
        - Choose an outfit that fits luxury real estate UGC — smart casual, elevated, clean.
        - In EVERY subsequent part, copy that exact outfit description verbatim, prefixed with: "SAME OUTFIT: [description]."
        - This is mandatory. Every single part after part 1 must include this line.

        DIALOGUE RULES:
        - Spoken language: ${language}. For Indian languages, ROMAN TRANSLITERATION only (e.g., "Yeh property sach mein...").
        - Write dialogue the way a real person talks to a friend — not a TV presenter.
        - Each part's dialogue is a standalone complete sentence. It must NOT continue from the previous clip and must NOT flow into the next.
        - Pick the single most powerful line from the script for each part. Short, punchy, conversational.
        - MAX 14 words. Count them. If over, trim.

        OUTPUT — valid JSON only, no markdown wrappers:
        {
          "voice_profile": "A young woman in her mid-20s speaks directly to camera in fluent ${language}, like sharing an exciting discovery with a close friend. Warm, unhurried, genuinely enthusiastic. Natural breathing between phrases. No performance voice — real conversation energy.",
          "parts": [
            { "prompt": "full Veo scene prompt including outfit description", "duration_seconds": 8 },
            { "prompt": "full Veo scene prompt with SAME OUTFIT line", "duration_seconds": 6 }
          ]
        }

        FOR EACH PART'S "prompt":
        - Line 1: scene location and avatar position.
        - Line 2: outfit — for part 1 describe it fresh; for all other parts use "SAME OUTFIT: [exact description from part 1]."
        - Line 3: the ONE physical action.
        - Line 4: EXACT dialogue in quotes.
        - Final line: append "${UGC_AESTHETICS}"

        THE SCRIPT TO ADAPT:
        ---
        ${script}
        ---`;

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
        if (Array.isArray(parsed.parts)) {
          parsed.parts.slice(0, MAX_CHUNKS).forEach((part, i) => {
            chunks.push({
              index: i,
              text: "",
              veoPrompt: part.prompt || "",
              estimatedSeconds: Math.min(Math.max(part.duration_seconds || 8, 6), 8),
              cameraDirection: "",
            });
          });
        }
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
  return `A young woman in her mid-20s speaks directly to camera in fluent ${language}, like she is sharing an exciting discovery with a close friend. Her voice is warm, unhurried, and genuinely enthusiastic. She breathes naturally between phrases and pauses to let the beauty of the property sink in. No performance voice, no announcement tone — real conversation energy.`;
}

function buildFallbackVeoPrompt(text, index, total, voicePrompt, langName) {
  return `Ultra-realistic real estate showcase video, 9:16 portrait for Instagram Reels.

🗣️ DIALOGUE: "${text}"

🎥 CAMERA: ${index === 0 ? "Fast zoom-in toward presenter standing at property gate, dynamic energetic movement" : index === total - 1 ? "Final close-up push-in toward presenter, strong confident ending expression" : "Wide cinematic exterior shot, presenter walking in front of property facade"}

⚠️ RULES: Exterior shots ONLY (gate, front elevation, balcony). NO interior shots. Match reference images exactly. NO text or watermarks on screen.

VOICE: ${voicePrompt}
Language: ${langName}. Perfect lip-sync mandatory. Ultra-realistic cinematic quality. Golden hour luxury lighting.`;
}
