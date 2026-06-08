import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/site-view/chunk-script
 *
 * Takes a full site-visit script + reference images (site shots + avatar),
 * then uses Gemini to:
 *   1. Split the script into 8-second spoken chunks (~20–25 words each)
 *   2. Generate a cinematic Veo director prompt for EACH chunk (site-tour framing)
 *   3. Generate a master voice prompt for voice consistency
 *
 * Input (FormData):
 *   script: string
 *   language: string
 *   siteImages[]: File[] (1–5 images of the construction/development site)
 *   avatarImages[]: File[] (1–5 presenter images)
 *
 * Output (JSON):
 *   {
 *     chunks: Array<{ index, text, estimatedSeconds, veoPrompt, cameraDirection }>,
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

    // Collect site images
    const siteImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`siteImage_${i}`);
      if (file) siteImages.push(file);
    }
    if (siteImages.length === 0) {
      const single = formData.get("siteImage");
      if (single) siteImages.push(single);
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

    const ai = new GoogleGenAI({ apiKey });

    async function uploadImageToGemini(file) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "image/jpeg";
      const blob = new Blob([buf], { type: mimeType });
      const uploaded = await ai.files.upload({
        file: blob,
        config: { mimeType, displayName: file.name || "image.jpg" },
      });
      return { uri: uploaded.uri, mimeType: uploaded.mimeType || mimeType };
    }

    const siteDataArr = siteImages.length > 0
      ? await Promise.all(siteImages.slice(0, 4).map(uploadImageToGemini))
      : [];
    const avatarDataArr = avatarImages.length > 0
      ? await Promise.all(avatarImages.slice(0, 2).map(uploadImageToGemini))
      : [];

    const languageMap = {
      english: "English", hindi: "Hindi", hinglish: "Hinglish", marathi: "Marathi",
      tamil: "Tamil", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam",
      bengali: "Bengali", gujarati: "Gujarati", punjabi: "Punjabi", urdu: "Urdu", odia: "Odia",
    };
    const langName = languageMap[language] || "English";

    const MAX_CHUNKS = 5;

    const SITE_AESTHETICS = `Vertical 9:16 video shot handheld on a smartphone, natural outdoor daylight lighting, slight camera movement as presenter walks. Authentic on-site presence — real construction/development site environment, natural ambient sounds, open sky. Relaxed confident posture, genuine enthusiasm for the project. Perfect lip sync with the spoken dialogue. No artificial studio lighting — pure natural outdoor light.`;

    const chunkingPrompt = `You are an expert AI video director for ultra-realistic real estate site-visit UGC content.
I have provided images of a real estate development site and a presenter (avatar), plus a script below.

STEP 1 — READ THE SCRIPT AND DECIDE HOW MANY PARTS ARE NEEDED:
Do NOT default to a fixed number. Analyze the script's natural story beats:
- Short script (1 main message): 2 parts
- Medium script (arrival + 1 feature): 3 parts
- Full script (arrival + infrastructure + plots + CTA): 4–5 parts
Maximum is ${MAX_CHUNKS} parts. Minimum is 2. Choose the smallest number that covers the full script naturally.

STEP 2 — TIMING RULE (CRITICAL):
Each part is ONE continuous video clip. A real person speaking at a calm walking pace delivers ~2 words per second.
Count your dialogue words and assign duration_seconds accordingly:
- 8–10 words → duration_seconds: 6
- 11–14 words → duration_seconds: 8
Never assign more than 8 seconds. Never assign less than 6 seconds.
DIALOGUE MUST BE MAX 14 WORDS PER PART. Count every word. Cut if over.
IMPORTANT: The dialogue must end at least 1 second before the clip ends — leave a natural breath/pause at the end.

STEP 3 — ONE ACTION PER PART:
- Each part has ONE physical action only. The avatar is mostly still while speaking.
- Never stack multiple actions. Never use "HARD CAMERA CUT" or any cut/transition language.
- For parts 2 and beyond: the clip must open with 1 second of silent natural movement (she turns, steps into position, or gestures at the site) BEFORE any dialogue begins.

SCENE STRUCTURE FOR SITE-VISIT:
- First part (Site Arrival): Avatar is standing at the site entrance or main gate, looking at the development site ahead. She turns to camera, takes in the view. That is the only action.
- Middle parts: Avatar standing at different spots on the site — plot boundary marker, infrastructure road, open land area, construction element. ONE still spot per part. She can point or gesture once toward what she's describing.
- Last part: Avatar faces camera directly at a key viewpoint of the site (open land or gate), warm confident smile, delivers the CTA.

OUTFIT CONSISTENCY RULE (critical — read carefully):
- Look carefully at the avatar reference image provided. Describe EXACTLY what the avatar is wearing: clothing color, style, any visible accessories, hair style. Be specific and literal — do not invent or change anything.
- In part 1's prompt, write this as: "AVATAR OUTFIT: [exact description of what you see in the reference image]."
- In EVERY subsequent part, copy that exact same outfit description verbatim, prefixed with: "SAME OUTFIT AS REFERENCE: [same description]."
- This is mandatory for every single part after part 1. Do not skip it.

DIALOGUE RULES:
- Spoken language: ${language}. For Indian languages, ROMAN TRANSLITERATION only.
- Write dialogue the way a real person talks while walking and showing someone around — excited, energetic, direct.
- Each part's dialogue is a standalone complete sentence. It must NOT continue from the previous clip.
- Pick the single most powerful line from the script for each part. Short, punchy, on-site energy.
- MAX 14 words. Count them. If over, trim.

OUTPUT — valid JSON only, no markdown wrappers:
{
  "voice_profile": "Speaks naturally in ${language}, energetic and confident, like a knowledgeable friend showing you around a great investment site.",
  "parts": [
    { "prompt": "full Veo scene prompt", "duration_seconds": 8 },
    { "prompt": "full Veo scene prompt", "duration_seconds": 6 }
  ]
}

FOR EACH PART'S "prompt" — write as ONE natural paragraph in this order:
1. Scene: where the avatar is on the site and their position.
2. Outfit: for part 1 write "Wearing: [exact outfit from avatar reference image]." For all other parts write "Same outfit: [same description]."
3. Action: the ONE physical action.
4. Dialogue: the exact words in quotes, preceded by "She says:"
5. Voice note (always last before aesthetics): "She speaks naturally in ${language}, energetic and confident, like a knowledgeable friend showing you around."
6. Append: "${SITE_AESTHETICS}"

THE SCRIPT TO ADAPT:
---
${script}
---`;

    const parts = [{ text: chunkingPrompt }];
    siteDataArr.forEach((d) => parts.push({ fileData: { fileUri: d.uri, mimeType: d.mimeType } }));
    avatarDataArr.forEach((d) => parts.push({ fileData: { fileUri: d.uri, mimeType: d.mimeType } }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts }],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "Failed to generate chunk prompts" }, { status: 502 });
    }

    let masterVoicePrompt = getDefaultVoicePrompt(language);
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
          cameraDirection: chunkIdx === 0 ? "Wide shot of presenter at site entrance" : "Presenter walking through development site",
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
      presenterDescription: "",
      totalChunks: chunks.length,
      totalEstimatedDuration,
    });
  } catch (error) {
    console.error("[SiteView] chunk-script error:", error);
    return NextResponse.json(
      { error: error.message || "Chunk generation failed" },
      { status: 500 }
    );
  }
}

function getDefaultVoicePrompt(language = "english") {
  return `A confident person in their late 20s speaks directly to camera in fluent ${language}, like they are showing an exciting investment opportunity to a close friend. Their voice is energetic, knowledgeable, and genuine — like someone who truly believes in the project they're standing on. Natural walking energy, real outdoor presence. No performance voice, no announcement tone.`;
}

function buildFallbackVeoPrompt(text, index, total, voicePrompt, langName) {
  return `Ultra-realistic real estate site-visit video, 9:16 portrait for Instagram Reels.

🗣️ DIALOGUE: "${text}"

🎥 CAMERA: ${index === 0 ? "Wide establishing shot of presenter standing at site entrance, natural outdoor lighting" : index === total - 1 ? "Final close-up push-in toward presenter, confident CTA expression, open site in background" : "Mid-shot of presenter on development site, open land and infrastructure visible behind"}

⚠️ RULES: Outdoor site shots ONLY (gate, boundary, roads, open plots, infrastructure). NO interior shots. Match reference images exactly. NO text or watermarks on screen.

VOICE: ${voicePrompt}
Language: ${langName}. Perfect lip-sync mandatory. Ultra-realistic cinematic quality. Natural outdoor daylight.`;
}
