import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { fal } from "@fal-ai/client";
import { synthesizeVoice } from "@/lib/voice-tts";
import { hasSufficientCreditsForAction } from "@/lib/credit-system";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}
export async function POST(request) {
  const { voiceId, voiceLabel = "your narrator", language = "english", text, action } = await request.json();
  if (!voiceId) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }

  // `action` is opt-in: only callers that pass their pipeline's credit-action
  // key get gated here (action-reel, comedy-reel, veo-long-ad today). Callers
  // that don't send it (e.g. luxury-car-exit) keep this route's old behavior.
  if (action) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const affordability = await hasSufficientCreditsForAction({
      userId: user._id.toString(),
      action,
    });
    if (!affordability.ok) {
      return NextResponse.json(affordability.payload, { status: affordability.status });
    }
  }

  // When previewing the user's own script (not the canned sample), speak the
  // whole thing — they're fine-tuning wording/voice settings, not just auditioning.
  const userScriptText = text?.trim();

  const PREVIEW_TEXTS = {
    hindi:    "यह शानदार प्रॉपर्टी लग्जरी और आराम का परफेक्ट मेल है! — आज ही अपनी साइट विजिट बुक करें!",
    hinglish: "Yeh stunning property luxury aur comfort ka perfect blend hai. Aaj hi site visit book karein!",
    tamil:    "இந்த அழகான சொத்து ஆடம்பரம் மற்றும் வசதியின் சரியான கலவையை வழங்குகிறது. இன்றே தள வருகையை பதிவு செய்யுங்கள்!",
    telugu:   "ఈ అద్భుతమైన ఆస్తి విలాసం మరియు సౌకర్యం యొక్క మిశ్రమాన్ని అందిస్తుంది. ఈరోజే సైట్ విజిట్ బుక్ చేసుకోండి!",
    bengali:  "এই অসাধারণ সম্পত্তি বিলাসিতা এবং আরামের নিখুঁত মিশ্রণ প্রদান করে। আজই আপনার সাইট ভিজিট বুক করুন!",
    marathi:  "ही भव्य मालमत्ता लक्झरी आणि आरामाचे परिपूर्ण मिश्रण देते. आजच साइट व्हिजिट बुक करा!",
    gujarati: "આ ભવ્ય મિલકત વૈભવ અને આરામનું સંપૂર્ણ મિશ્રણ પ્રદાન કરે છે. આજે જ સાઇટ વિઝિટ બુક કરો!",
    punjabi:  "ਇਹ ਸ਼ਾਨਦਾਰ ਸੰਪਤੀ ਲਗਜ਼ਰੀ ਅਤੇ ਆਰਾਮ ਦਾ ਸੰਪੂਰਨ ਮੇਲ ਦਿੰਦੀ ਹੈ। ਅੱਜ ਹੀ ਸਾਈਟ ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ!",
    english:  `Hi, I'm ${voiceLabel}. This stunning property offers the perfect blend of luxury and comfort. Book your site visit today!`,
  };
  const previewText = userScriptText || (PREVIEW_TEXTS[language] ?? PREVIEW_TEXTS.english);

  try {
    const { buffer, contentType } = await synthesizeVoice({
      text: previewText,
      voiceId,
      language,
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[preview-voice] failed:", err.message);
    return NextResponse.json({ error: err.message || "Preview failed" }, { status: 500 });
  }
}
