import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { resolveUserFromSession } from "@/lib/user-resolver";

/**
 * POST /api/product-video/generate-voice-prompt
 * Generate a hyper-detailed voice description prompt based on the avatar image + script.
 * This voice prompt will be used by Veo 3.1 to generate realistic speech.
 * Input: FormData with compositeImage (file) + script (string)
 * Output: { voicePrompt: string }
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const compositeFile = formData.get("compositeImage");
    const script = formData.get("script");
    const allowEmotionTags = formData.get("allowEmotionTags") === "true";

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

    const emotionNote = allowEmotionTags
      ? "The script may include inline emotion tags like {{happy}}, {{sad}}, {{excited}}, {{calm}}. Use these tags to shape delivery, but do NOT speak the tags aloud."
      : "Do not assume any special tags in the script.";

    const prompt = `You are an expert voice casting director specializing in UGC (User Generated Content) and social media creator videos.

Look at this image of a person presenting a product. They will speak the following script in a short product video:

SCRIPT: "${script}"

${emotionNote}

Based on:
1. The person's apparent gender, age, ethnicity, and overall vibe from the image
2. The tone and content of the script
3. How a REAL, popular UGC creator would naturally deliver this — think the best Instagram Reels and TikTok product reviewers who feel genuine and magnetic on camera

Generate a DETAILED voice description prompt that captures exactly how this person should sound. The voice must feel AUTHENTICALLY EXCITED and EXPRESSIVE — like a creator who genuinely discovered a product they love and can't wait to tell people about it. NOT a stiff corporate presenter.

FORMAT — Return a single paragraph with ALL of these attributes, comma-separated:
- Gender and age range
- Accent type (be specific — e.g., "neutral Indian-English accent", "slight South Indian lilt", "Mumbai urban accent")
- Pitch level and VARIATION (e.g., "medium pitch that rises with excitement on key features and drops for emphasis on reveals")
- Tone quality (warm, bright, bubbly, magnetic, etc.)
- Emotional delivery — this is KEY: describe the excitement arc (e.g., "opens with excited discovery energy, builds genuine enthusiasm, peaks with a 'you NEED this' conviction")
- Speaking style: casual UGC creator — like FaceTiming your best friend to show them something amazing, NOT reading a teleprompter
- Vocal expressiveness cues (e.g., "audible smile throughout, slight gasp of excitement before revealing a feature, natural vocal fry on casual phrases, emphasis through volume + pitch change not just speed")
- Pacing: describe the RHYTHM — fast excited bursts for features, natural pauses before big reveals, conversational speed changes
- Energy level: high but AUTHENTIC — the difference between "influencer fake excited" and "genuinely can't believe how good this is"
- Natural vocal habits (quick inhale before an excited phrase, slight laugh while talking, the "oh my god you guys" energy)
- RECORDING QUALITY (CRITICAL): describe the mic feel — must be dry close-mic (6 inches from mouth), zero reverb, zero echo, zero robotic artifacts, warm natural chest resonance, subtle lip-smack between sentences, natural sibilance on 's' sounds, soft room ambient hum (NOT dead digital silence), natural dynamic range (louder for excited, softer for intimate)
- Background ambience: very soft natural room tone ONLY, NO music, NO echo, intimate close-mic presence

CRITICAL RULES:
1. Return ONLY the voice description paragraph. No headers, no explanations.
2. The voice MUST sound like a REAL human recording — absolutely ZERO robotic, metallic, or synthetic qualities.
3. Always include the recording quality details — they are essential for making the voice sound authentic.

EXAMPLE OUTPUT:
"Female, age 22-28, neutral Indian-English accent with casual urban Mumbai inflection, medium-high pitch that rises noticeably with excitement when describing features and drops to a conspiratorial whisper for the 'secret tip' moment, bright and bubbly tone with natural warmth, genuinely enthusiastic delivery that opens with surprised discovery energy and builds to 'you HAVE to try this' conviction, casual UGC creator style like she's FaceTiming her best friend to show them her new favorite thing, audible smile throughout with a slight delighted laugh mid-sentence, quick excited inhale before revealing the best feature, natural vocal fry on casual phrases like 'literally obsessed', pacing alternates between fast excited bursts and deliberate pauses for emphasis at about 155 words per minute, high energy that feels completely authentic and unscripted, clear but casual articulation that occasionally speeds up with genuine excitement, recorded on a dry close-mic with zero reverb and zero echo, warm chest resonance with natural sibilance on 's' sounds, subtle lip-smack between phrases, very soft room ambient hum, natural dynamic range with louder excited peaks and softer intimate drops, absolutely no robotic or metallic artifacts."`;

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

    // Clean up — remove surrounding quotes if present
    voicePrompt = voicePrompt.replace(/^["']|["']$/g, "");

    return NextResponse.json({ success: true, voicePrompt });
  } catch (error) {
    console.error("[ProductVideo] Generate voice prompt error:", error);
    return NextResponse.json({ error: error.message || "Voice prompt generation failed" }, { status: 500 });
  }
}
