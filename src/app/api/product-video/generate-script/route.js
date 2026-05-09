import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/product-video/generate-script
 * Generate scripts for videos - always returns 2 scripts (short and long form)
 * 
 * Input: FormData with:
 *   - compositeImage_0, compositeImage_1, ... (multiple reference composites)
 *   - productImage (file)
 *   - compositeCount (number)
 *   - language (string)
 *   - tone (string)
 *   - allowEmotionTags (boolean)
 *   - scriptTypes (JSON array) - ["short_form", "long_form"]
 *   - targetScriptCount (number) - defaults to 2
 * 
 * Output: { scripts: [{ type, fullScript, duration, references }] }
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
    const scriptTypes = JSON.parse(formData.get("scriptTypes") || '["short_form", "long_form"]');
    const targetScriptCount = parseInt(formData.get("targetScriptCount") || "2");
    const availableAngles = formData.get("availableAngles") || "";
    const userIntent = formData.get("userIntent") || "";

    if (!productFile) {
      return NextResponse.json({ error: "productImage is required" }, { status: 400 });
    }

    if (compositeCount === 0) {
      return NextResponse.json({ error: "At least one composite image is required" }, { status: 400 });
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
    
    // Get all composite images
    const compositeFiles = [];
    for (let i = 0; i < compositeCount; i++) {
      const f = formData.get(`compositeImage_${i}`);
      if (f) compositeFiles.push(f);
    }

    const compositeDataArr = await Promise.all(compositeFiles.map(fileToBase64));

    const ai = new GoogleGenAI({ apiKey });

    const languageInstructions = {
      english: "Write the script in natural, conversational English.",
      hindi: "Write the script in natural, conversational Hindi (Devanagari script).",
      hinglish: "Write the script in Hinglish — a natural mix of Hindi and English words as spoken casually in urban India. Use Roman script.",
    };
    const langInstruction = languageInstructions[language] || languageInstructions.english;

    const emotionTagInstruction = allowEmotionTags
      ? "You may insert emotion tags like {{happy}}, {{excited}}, {{amazed}}, {{smile}} inline before the phrase they affect. Keep tags exactly as written."
      : "Do NOT include any emotion tags or special markup.";

    // Generate scripts for each type (short and long)
    const scripts = [];
    
    for (const scriptType of scriptTypes) {
      const isShortForm = scriptType === "short_form";
      const duration = isShortForm ? "8-10 seconds" : "45-60 seconds";
      const wordCount = isShortForm ? "25-35 words" : "150-200 words";
      const hookStyle = isShortForm 
        ? "Start with an immediate attention-grabbing hook in first 2 seconds" 
        : "Start with a compelling hook, then build narrative depth";
      
      // Build prompt based on script type
      const prompt = `You are an expert UGC (User Generated Content) script writer for real estate and product videos.

You are given ${compositeDataArr.length} different composite images — each shows the SAME person presenting the SAME property/product but from DIFFERENT camera angles and poses (${availableAngles || "front, three-quarter, side views"}). You also have a close-up of the property/product itself.

${userIntent ? `USER'S SPECIFIC REQUEST: "${userIntent}" - Please incorporate this into the script naturally.\n` : ''}

TASK: Write a ${duration} spoken video script (${wordCount}) for the ${isShortForm ? 'SHORT FORM' : 'LONG FORM'} version.

VIDEO DURATION: ${duration}
SCRIPT LENGTH: ${wordCount}
TONE: ${tone}
LANGUAGE: ${langInstruction}

REQUIREMENTS FOR ${isShortForm ? 'SHORT' : 'LONG'} SCRIPT:

${isShortForm ? `
SHORT FORM (8-10 seconds):
- Maximum 25-35 words (critical for 8-second delivery)
- Start with an immediate hook (2-3 words max)
- Focus on ONE key benefit or feature
- End with a soft call-to-action
- Match the energy of the primary composite angle
- Natural UGC creator language — like talking to their phone camera
` : `
LONG FORM (45-60 seconds):
- 150-200 words for natural spoken pace
- Smooth narrative arc: Hook → Problem → Solution → Benefits → Close
- Reference DIFFERENT angles from the composites naturally throughout:
  * Opening (seconds 0-10): Use front-facing angle, direct eye contact
  * Middle (seconds 10-35): Incorporate three-quarter and side angles for variety
  * Close (seconds 35-45): Return to front angle for connection
- Include 2-3 specific property/product features
- Build excitement gradually
- Natural transitions that match visual changes
`}

ADDITIONAL REQUIREMENTS FOR BOTH:
- ${emotionTagInstruction}
- Do NOT include stage directions, emojis, or special formatting
- Make it sound authentic — like a real person, NOT scripted or salesy
- Use casual, conversational language
- Reference visual elements naturally where appropriate
- Return ONLY the script text, nothing else

${isShortForm ? 'Remember: 8-10 seconds only! The script must be speakable in that timeframe.' : ''}`;

      // Use all composite images as context
      const parts = [
        { text: prompt },
        ...compositeDataArr.map((d) => ({ inlineData: d })),
        { inlineData: productData },
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
        },
      });

      let scriptText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!scriptText) {
        // Fallback script based on type
        scriptText = isShortForm 
          ? "This property is absolutely stunning! You have to see this view. Schedule your tour today!"
          : "Welcome to this beautiful property. From the moment you walk in, you'll notice the attention to detail. The open concept layout flows perfectly, and the natural light is incredible. The kitchen features modern appliances and ample counter space. Upstairs, you'll find spacious bedrooms. And wait until you see the backyard. Don't wait - schedule your showing today!";
      }

      scripts.push({
        id: scripts.length,
        type: scriptType,
        title: isShortForm ? "Short Video (8-10 seconds)" : "Full Video (45-60 seconds)",
        duration: isShortForm ? "short" : "long",
        fullScript: scriptText,
        wordCount: scriptText.split(/\s+/).length,
        references: compositeCount,
        angles: availableAngles || "multiple angles"
      });
    }

    // Ensure we have exactly targetScriptCount scripts
    while (scripts.length < targetScriptCount) {
      scripts.push({
        id: scripts.length,
        type: scripts.length === 0 ? "short_form" : "long_form",
        title: scripts.length === 0 ? "Short Video" : "Full Video",
        duration: scripts.length === 0 ? "short" : "long",
        fullScript: "Discover this amazing property with stunning features and modern amenities. Book your visit today!",
        wordCount: 12,
        references: compositeCount,
        angles: availableAngles
      });
    }

    return NextResponse.json({ 
      success: true, 
      scripts: scripts.slice(0, targetScriptCount),
      metadata: {
        compositeCount,
        availableAngles,
        language,
        tone,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("[ProductVideo] Generate script error:", error);
    return NextResponse.json({ 
      error: error.message || "Script generation failed",
      fallback: true,
      scripts: [
        {
          id: 0,
          type: "short_form",
          title: "Short Video (8-10 seconds)",
          duration: "short",
          fullScript: "This property is incredible! You won't believe the views. Come see it for yourself today!",
          wordCount: 16,
          references: 1
        },
        {
          id: 1,
          type: "long_form",
          title: "Full Video (45-60 seconds)",
          duration: "long", 
          fullScript: "Welcome to this stunning property. From the moment you walk in, you'll be amazed by the attention to detail and natural light throughout. The open concept living area flows perfectly into a gourmet kitchen. Upstairs, spacious bedrooms and modern bathrooms await. And don't even get me started on the backyard oasis. Schedule your private tour today before it's gone!",
          wordCount: 68,
          references: 1
        }
      ]
    }, { status: 500 });
  }
}