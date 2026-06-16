import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { ELEVENLABS_VOICE_SETTINGS } from "@/lib/elevenlabs-config";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}
export async function POST(request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
  }

  const { voiceId, voiceLabel = "your narrator", language = "english" } = await request.json();
  if (!voiceId) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }

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
  const previewText = PREVIEW_TEXTS[language] ?? PREVIEW_TEXTS.english;

  const result = await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
    input: {
      text: previewText,
      voice: voiceId,
      stability:        ELEVENLABS_VOICE_SETTINGS.stability,
      similarity_boost: ELEVENLABS_VOICE_SETTINGS.similarity_boost,
      style:            ELEVENLABS_VOICE_SETTINGS.style,
      speed:            ELEVENLABS_VOICE_SETTINGS.speed,
    },
    logs: false,
  });

  const audioUrl = result?.data?.audio_url || result?.data?.audio?.url;
  if (!audioUrl) {
    return NextResponse.json({ error: "fal ElevenLabs returned no audio URL" }, { status: 502 });
  }

  const res = await fetch(audioUrl);
  if (!res.ok) {
    return NextResponse.json({ error: `Failed to fetch preview audio: ${res.status}` }, { status: 502 });
  }

  const audioBuf = Buffer.from(await res.arrayBuffer());
  return new Response(audioBuf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuf.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
