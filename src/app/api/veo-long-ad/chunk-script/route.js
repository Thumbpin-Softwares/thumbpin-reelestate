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
      ? await Promise.all(locationImages.slice(0, 1).map(fileToBase64))
      : [];
    const avatarDataArr = avatarImages.length > 0
      ? await Promise.all(avatarImages.slice(0, 1).map(fileToBase64))
      : [];

    const ai = new GoogleGenAI({ apiKey });

    const languageMap = {
      english: "English", hindi: "Hindi", hinglish: "Hinglish", marathi: "Marathi",
      tamil: "Tamil", telugu: "Telugu", kannada: "Kannada", malayalam: "Malayalam",
      bengali: "Bengali", gujarati: "Gujarati", punjabi: "Punjabi", urdu: "Urdu", odia: "Odia",
    };
    const langName = languageMap[language] || "English";

    const MAX_CHUNKS = 5;

    const chunkingPrompt = `You are a world-class AI video director and cinematic real-estate filmmaker specializing in ultra-realistic luxury property social media ads.

Your goal is to generate highly believable human-centered real-estate video prompts that feel naturally filmed rather than AI-generated.

TASK:
1. Split the provided script into natural spoken chunks.
2. Each chunk should feel like a distinct, punchy social media clip cut.
3. Keep each chunk approximately 4–6 seconds long — shorter cuts feel more dynamic and reel-like.
4. Never split mid-sentence or mid-thought.
5. Combine smaller lines naturally when needed.
6. Generate a MASTER VOICE PROMPT for consistent voice realism across all chunks.
7. Generate a PRESENTER DESCRIPTION (physical appearance) from the avatar reference image.
8. For every chunk, generate a cinematic VEO production prompt grounded in:
   • the provided avatar reference image
   • the provided property reference images

SHOT VARIETY RULES (MANDATORY):
• Every chunk MUST use a DIFFERENT shot type from the previous chunk — never repeat the same angle consecutively
• Rotate through these types: (1) Wide establishing shot, (2) Medium presenter shot, (3) Close-up presenter shot, (4) Walking/moving shot with presenter, (5) B-roll property exterior (NO presenter in frame)
• If the script has 3 or more chunks: at least 1 chunk MUST be pure B-roll (architectural exterior, gate, landscaping — no presenter visible)
• Chunk 1: always a dynamic wide or medium shot that introduces the presenter and property together
• Last chunk: memorable close-up push-in or slow pull-back to end strongly
• Think like a real Instagram reel editor — fast, visual, diverse

SCRIPT:
---
${script}
---

LANGUAGE:
${langName}

MAXIMUM CHUNKS:
${MAX_CHUNKS}

OUTPUT FORMAT:

MASTER_VOICE_PROMPT:
[CRITICAL: First, look at the avatar/presenter reference image. Determine the presenter's gender from the image — you MUST commit to exactly "male voice" or "female voice", never leave it ambiguous or say "male or female". Then write one highly detailed paragraph describing their voice: start with the explicit gender (e.g. "Female voice" or "Male voice"), estimated age range, accent, pitch, tone quality, pacing, breathing, microphone quality, conversational style, and emotional realism. This will be used for ALL chunks — the gender and vocal identity must be completely locked and consistent throughout.]

PRESENTER_DESCRIPTION:
[Look at the avatar/presenter reference image. Write ONE concise sentence describing their exact physical appearance: gender, approximate age, hair color and style, skin tone, and specific clothing/outfit with colors. This will be used to anchor the presenter's identity in AI video continuations. Example: "Indian woman, late 20s, long straight dark hair, warm medium-brown skin, wearing a navy blazer over a white top." If no avatar image provided, write "Presenter: appearance unknown."]

CHUNKS:

[CHUNK 1]

TEXT:
[Exact spoken text]

ESTIMATED_SECONDS:
[Estimated duration]

CAMERA_DIRECTION:
[One-line natural camera movement summary]

VEO_PROMPT:

🎬 VEO 3.1 PROMPT — CHUNK 1 OF X (${langName.toUpperCase()}, 4–6 SEC)

🎭 CHARACTER (from avatar reference image):
• Preserve the exact identity, hairstyle, facial structure, skin tone, clothing, and overall appearance from the reference image
• Natural luxury property presenter casually speaking to camera
• Authentic human appearance with realistic facial depth, natural asymmetry, blinking, breathing, and relaxed body posture
• Minimal expressions and subtle conversational emotion only
• Avoid influencer behavior, model posing, exaggerated confidence, or commercial acting
• Avoid over-smoothed skin, artificial sharpness, CGI textures, or synthetic beauty aesthetics
• Slight natural imperfections and candid body language encouraged
• Natural lip-sync aligned to realistic speech pacing

🗣️ DIALOGUE:
"[Exact dialogue from this chunk]"

🎙️ HUMAN PERFORMANCE STYLE:
• Delivery should feel naturally spoken in one take
• Conversational pacing instead of presenter pacing
• Small pauses and natural breathing allowed
• Slight vocal variation and realistic rhythm changes
• Casual authentic delivery, not overly polished
• Eye contact should feel imperfect and natural
• Small natural head movement and subtle posture shifts
• Minimal hand gestures only when realistic

🎥 CAMERA & SHOT:
[Describe ONE continuous realistic shot]

Include:
• shot type
• framing
• camera distance
• realistic camera movement
• environmental movement
• natural lighting behavior

Camera should behave like:
• handheld gimbal footage
• luxury Instagram reel filming
• human-operated camera
• subtle movement inertia
• tiny framing imperfections
• realistic focus behavior
• slight handheld micro-jitter

Avoid:
• robotic tracking
• impossible camera movement
• over-stabilized floating shots
• aggressive cinematic orbit shots

🏠 VISUAL CONTEXT:
Ground visuals strictly in the provided property reference images.

Describe:
• modern luxury architecture
• exterior facade
• driveway
• entrance gate
• balcony
• landscaping
• natural outdoor materials
• realistic reflections and shadows
• environmental motion like leaves, fabric, or hair movement

Use:
• realistic golden hour lighting
• documentary-style realism
• natural dynamic range
• believable exterior environment

⚠️ STRICT RULES:
• ONLY exterior shots
• NO interiors
• NO text overlays
• NO subtitles
• NO logos
• NO watermarks
• 9:16 vertical framing
• Ultra-realistic cinematic quality
• Documentary-commercial hybrid realism
• Maintain believable proportions and realistic human motion
• Prioritize realism over cinematic perfection
• Avoid uncanny valley behavior entirely

🎞️ VISUAL REALISM STYLE:
• Authentic luxury real-estate Instagram reel aesthetic
• Feels filmed on a high-end cinema camera with handheld stabilization
• Realistic motion blur and natural exposure adaptation
• Organic environmental movement
• Natural lighting falloff
• Soft realistic shadows
• Real-world texture response
• Avoid hyper-detailed CGI look
• Avoid “AI influencer” aesthetics
• Preserve believable human movement and timing

🎙️ VOICE DIRECTION:
• Language: ${langName}
• Tone: Calm, conversational, aspirational
• Energy: Controlled and believable
• Pace: Natural human speaking rhythm
• Recording Style: Premium wireless mic or smartphone creator setup
• Avoid announcer voice or commercial narration tone

[END_CHUNK]

IMPORTANT GLOBAL RULES:
• Prioritize believable realism over cinematic perfection
• Keep movement subtle and physically believable
• Human behavior should feel candid, not performed
• Do not over-direct expressions
• Avoid AI-perfect facial symmetry
• Avoid robotic pacing or movement
• Shots should feel naturally filmed for social media
• NEVER use the same shot type twice in a row — vary every chunk
• Preserve continuity between chunks on presenter appearance and property style
• Use realistic environmental physics and motion
• Return ONLY the structured output`;

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

    // ── Parse the structured output ──────────────────────────────────────────
    const masterVoiceMatch = rawText.match(/MASTER_VOICE_PROMPT:\s*\n([\s\S]*?)(?=\nPRESENTER_DESCRIPTION:|CHUNKS:|$)/i);
    const masterVoicePrompt = masterVoiceMatch?.[1]?.trim() || getDefaultVoicePrompt(language);

    const presenterDescMatch = rawText.match(/PRESENTER_DESCRIPTION:\s*\n([\s\S]*?)(?=\nCHUNKS:|$)/i);
    const presenterDescription = presenterDescMatch?.[1]?.trim() || "";

    const chunks = [];
    const chunkRegex = /\[CHUNK\s+\d+\]([\s\S]*?)\[END_CHUNK\]/gi;
    let match;

    while ((match = chunkRegex.exec(rawText)) !== null) {
      const block = match[1];

      const textMatch = block.match(/TEXT:\s*(.+?)(?=\nESTIMATED_SECONDS:|$)/is);
      const secondsMatch = block.match(/ESTIMATED_SECONDS:\s*(\d+)/i);
      const cameraMatch = block.match(/CAMERA_DIRECTION:\s*(.+?)(?=\nVEO_PROMPT:|$)/is);
      const veoMatch = block.match(/VEO_PROMPT:\s*([\s\S]+?)$/i);

      const text = textMatch?.[1]?.trim().replace(/^["']|["']$/g, "") || "";
      const estimatedSeconds = parseInt(secondsMatch?.[1] || "8");
      const cameraDirection = cameraMatch?.[1]?.trim() || "";
      const veoPrompt = veoMatch?.[1]?.trim() || "";

      if (text) {
        chunks.push({
          index: chunks.length,
          text,
          estimatedSeconds,
          cameraDirection,
          veoPrompt,
        });
      }
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
