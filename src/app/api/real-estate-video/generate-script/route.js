import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { resolveUserFromSession } from "@/lib/user-resolver";

/**
 * POST /api/real-estate-video/generate-script
 *
 * Generates a cinematic director prompt for each location photo using selected avatar references.
 * Supports both single and batch inputs:
 * - locationImage / locationImage_0..N
 * - avatarImage / avatarImage_0..N
 * - userIntent / userIntent_0..N
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const language = (formData.get("language") || "english").toString();
    const tone = (formData.get("tone") || "professional").toString();
    const allowEmotionTags = formData.get("allowEmotionTags") === "true";
    const userIntent = (
      formData.get("userIntent") ||
      formData.get("script") ||
      ""
    )
      .toString()
      .trim();
    const locationCount = parseInt(formData.get("locationCount")) || 0;
    const avatarCount = parseInt(formData.get("avatarCount")) || 0;

    async function fileToBase64(file) {
      const buf = Buffer.from(await file.arrayBuffer());
      return {
        data: buf.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    const languageMap = {
      english: "natural confident Indian-English",
      hindi: "natural Hindi (Devanagari script)",
      hinglish: "casual Hinglish — Hindi+English mix in Roman script",
      marathi: "natural Marathi, warm Maharashtrian tone",
      tamil: "natural Tamil, polished South Indian tone",
      telugu: "natural Telugu, smooth clear delivery",
      kannada: "natural Kannada, calm confident delivery",
      malayalam: "natural Malayalam, elegant grounded delivery",
      bengali: "natural Bengali, soft expressive delivery",
      gujarati: "natural Gujarati, bright friendly tone",
      punjabi: "natural Punjabi, warm energetic delivery",
      urdu: "natural Urdu, elegant expressive delivery",
      odia: "natural Odia, smooth conversational delivery",
    };

    const langRule = languageMap[language] || languageMap.english;
    const emotionRule = allowEmotionTags
      ? "Emotion tags like {{excited}}, {{warm}}, {{confident}} are allowed in the spoken part if they improve delivery."
      : "Do not use emotion tags or markup in the spoken part.";

    const locationFiles = [];
    const avatarFiles = [];
    const perClipIntents = [];

    // Collect location images (batch mode)
    if (locationCount > 0) {
      for (let i = 0; i < locationCount; i++) {
        const file = formData.get(`locationImage_${i}`);
        const intent = (formData.get(`userIntent_${i}`) || "").toString().trim();
        if (file) locationFiles.push(file);
        perClipIntents.push(intent);
      }
    }

    // Fallback: single location image
    if (locationFiles.length === 0) {
      const singleLocation =
        formData.get("locationImage") || formData.get("propertyImage");
      if (singleLocation) locationFiles.push(singleLocation);
    }

    // Collect avatar images
    if (avatarCount > 0) {
      for (let i = 0; i < avatarCount; i++) {
        const file = formData.get(`avatarImage_${i}`);
        if (file) avatarFiles.push(file);
      }
    }

    // Fallback: single avatar image
    if (avatarFiles.length === 0) {
      const singleAvatar = formData.get("avatarImage");
      if (singleAvatar) avatarFiles.push(singleAvatar);
    }

    if (locationFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one locationImage is required" },
        { status: 400 }
      );
    }

    const locationDataArr = await Promise.all(
      locationFiles.map(fileToBase64)
    );
    const avatarDataArr = avatarFiles.length
      ? await Promise.all(avatarFiles.map(fileToBase64))
      : [];

    const languageDialectMap = {
      english: { name: "English", script: "English" },
      hindi: { name: "Hindi", script: "Devanagari → Roman transliteration (e.g., 'Namaste' style)" },
      hinglish: { name: "Hinglish", script: "Roman script mix of Hindi+English" },
      marathi: { name: "Marathi", script: "Roman transliteration (Maharashtrian)" },
      tamil: { name: "Tamil", script: "Roman transliteration (South Indian)" },
      telugu: { name: "Telugu", script: "Roman transliteration (South Indian)" },
      kannada: { name: "Kannada", script: "Roman transliteration" },
      malayalam: { name: "Malayalam", script: "Roman transliteration (South Indian)" },
      bengali: { name: "Bengali", script: "Roman transliteration" },
      gujarati: { name: "Gujarati", script: "Roman transliteration" },
      punjabi: { name: "Punjabi", script: "Roman transliteration (Punjabi accent)" },
      urdu: { name: "Urdu", script: "Roman transliteration (Urdu style)" },
      odia: { name: "Odia", script: "Roman transliteration" },
    };

    const selectedLang = languageDialectMap[language] || languageDialectMap.english;
    const variants = parseInt(formData.get("variants")) || 1;

    const basePrompt = `You are a world-class KLING AI prompt writer for luxury real-estate video ads.

Generate ${variants} UNIQUE and DETAILED KLING AI VIDEO PRODUCTION PROMPT(S) for an 8-second Google Veo luxury villa/property ad for the provided property image.

LANGUAGE: ${selectedLang.name} (${selectedLang.script})
TONE: ${tone}
${emotionRule}

IMPORTANT (use the provided images to make prompts location-specific):
- Write dialogue in ROMAN TRANSLITERATION (English letters pronounced as ${selectedLang.name}).
- Focus on EXTERIOR shots ONLY (gate, front elevation, balcony/drone shot from outside).
- Use ONLY the provided property image reference and character reference image (avatar).
- NO interior shots, NO generated architecture, NO additional house designs.
- Include cinematic character appearance details derived from the avatar image.
- Duration for every variant is EXACTLY 8 seconds.
- STRICT GUARDRAILS: No extra ambient noise, no off-screen voice, no additional transitions or visual effects not described in the variant, no interior inserts, and no on-screen text overlays unless explicitly requested in user intent.

OUTPUT FORMAT & DELIMITERS (important for parsing):
- Generate exactly ${variants} distinct variants for this property.
- Separate each VARIANT with the line: === VARIANT ===
- Separate different PROPERTIES (when in batch) with the line: === PROPERTY ===
- Return ONLY plain text (no JSON, no markdown fences). Use the delimiters above exactly.

PROMPT FORMAT (for each variant) — keep this structure and fill with location-specific details:

🎬 KLING AI PROMPT — 8 SEC LUXURY PROPERTY AD (${selectedLang.name.toUpperCase()})

🎭 CHARACTER LOOK (Use the character from reference image)
• [Detailed character description inferred from avatar image: appearance, age range, styling, vibe]
• [Clothing and styling details]
• [Expression and presence]
• Character must directly speak to camera with accurate lip-sync dialogue

⚠️ IMPORTANT VISUAL RULES
• Use ONLY the provided property image reference and Character reference image
• NO interior shots at all
• NO additional house designs or generated architecture
• Entire video should happen ONLY:
  — In front of property gate
  — On the front elevation / facade
  — Balcony/drone exterior shots from outside only
• Creator should appear:
  — Standing near main gate
  — Walking in front of property
  — Standing on prominent exterior spot for camera

🗣️ DIALOGUE (${selectedLang.name} in Roman transliteration — fast, urgent, persuasive)

[Write 4–8 short spoken fragments/lines in ${selectedLang.name} using Roman letters for pronunciation. Keep lines punchy, property-specific, and ordered to map to the camera beats below.]

🎙️ VOICE DIRECTION
• Language: ${selectedLang.name}
• Style: Real-estate influencer / creator
• Tone: Attention-grabbing + urgency + energetic
• Speaking Speed: Fast but clear
• Emotion: Excited, persuasive, premium
• Strong hook within first 1–2 seconds
• Perfect lip-sync matching mandatory

🎥 CAMERA & VIDEO DIRECTION (8 SEC) — MULTISHOT MAPPED TO DIALOGUE
0–2 sec: Fast zoom-in toward creator at property gate — creator speaks hook line. Dynamic energetic camera movement.
2–4 sec: Wide exterior beauty shot; creator walking/gesturing while speaking the next line.
4–6 sec: Close-up shot with property in background; intimate line, subtle gesture.
6–8 sec: Drone/wide exterior beauty shot (balcony/drone) or final close-up push-in; strong closing line and call-to-action.

Include brief suggested camera moves, framing, and beats for each line. If a variant requires a different cut (e.g., swap a drone moment earlier), describe it explicitly within that variant.

VISUAL STYLE
• Ultra realistic cinematic
• Premium luxury real-estate commercial vibe
• Golden hour / warm luxury lighting
• High-end Instagram creator aesthetics
• Cinematic depth of field

MUSIC & SOUND GUARDRAILS
• By default: NO added ambient noise or off-screen voice; only include background music if explicitly requested in user intent.
• If music requested: energetic premium beats with cinematic bass, low in mix to preserve voice clarity.

Use the property image to add 1–2 sentences of location-specific visual notes (unique features, standout angles, or focal points) for each variant so prompts are distinct and tailored.
`;

    // Batch mode: generate one prompt per location photo
    if (locationDataArr.length > 1) {
      const intentLines = locationDataArr
        .map((_, i) => {
          const resolved = perClipIntents[i] || userIntent;
          return resolved
            ? `Property ${i + 1}: "${resolved}"`
            : `Property ${i + 1}: (AI decides)`;
        })
        .join("\n");

      const batchPrompt = `${basePrompt}

You will receive ${locationDataArr.length} property images that should become ${locationDataArr.length} separate 8-second video ads.
The same character/avatar reference must be used across all videos.
Create one DETAILED KLING AI PROMPT per property image.

PER-PROPERTY INTENT:
${intentLines}

Return ONLY the prompts as plain text (NOT JSON). Separate each property's prompt with a clear delimiter line of === between them.`;

      const parts = [{ text: batchPrompt }];
      locationDataArr.forEach((d) => parts.push({ inlineData: d }));
      avatarDataArr.forEach((d) => parts.push({ inlineData: d }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
      });

      const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) {
        return NextResponse.json(
          { error: "Failed to generate prompts" },
          { status: 502 }
        );
      }

      // Parse properties and variants using explicit delimiters
      const propertyBlocks = rawText
        .split(/===\s*PROPERTY\s*===/i)
        .map((p) => p.trim())
        .filter(Boolean);

      const prompts = propertyBlocks.map((pb) => {
        const variantsArr = pb
          .split(/===\s*VARIANT\s*===/i)
          .map((v) => v.trim())
          .filter(Boolean);
        return { variants: variantsArr.length ? variantsArr : [pb] };
      });

      const result = {
        success: true,
        count: Math.min(prompts.length, locationDataArr.length),
        prompts: prompts.slice(0, locationDataArr.length),
      };

      return NextResponse.json(result);
    }

    // Single mode: generate one prompt for the single location photo
    const singlePrompt = `${basePrompt}

You will receive exactly 1 property image and 1 character reference image.
Use the character from the avatar image.
Create ONE detailed KLING AI PROMPT for this property.

${userIntent ? `SPECIFIC PROPERTY NOTES: ${userIntent}` : ""}

Return ONLY the formatted KLING AI prompt as plain text (no JSON, no markdown backticks, no code blocks).
Fill in all sections with property-specific and character-specific details based on the images provided.`;

    const parts = [{ text: singlePrompt }];
    if (userIntent) {
      parts.push({ text: `Additional context: ${userIntent}` });
    }
    locationDataArr.forEach((d) => parts.push({ inlineData: d }));
    avatarDataArr.forEach((d) => parts.push({ inlineData: d }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      return NextResponse.json(
        { error: "Failed to generate prompt" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt: rawText,
    });
  } catch (error) {
    console.error("[RealEstateVideo] Generate prompt error:", error);
    return NextResponse.json(
      { error: error.message || "Prompt generation failed" },
      { status: 500 }
    );
  }
}
