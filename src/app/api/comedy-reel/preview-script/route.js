import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { ELEVENLABS_VOICE_SETTINGS } from "@/lib/elevenlabs-config";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const MAX_PREVIEW_CHARS = 600;

/**
 * POST /api/comedy-reel/preview-script
 *
 * Previews the user's ACTUAL typed script text — fully ephemeral, no R2
 * upload, no DB writes, no credit charge.
 */
export async function POST(request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
  }

  const { text, voiceId } = await request.json();
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!voiceId) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }

  const previewText = text.trim().slice(0, MAX_PREVIEW_CHARS);
  const vs =
    ELEVENLABS_VOICE_SETTINGS[voiceId] ??
    ELEVENLABS_VOICE_SETTINGS["dVTC43Yewy5fAIcmsISI"];

  try {
    const result = await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
      input: {
        text: previewText,
        voice: voiceId,
        stability: vs.stability,
        similarity_boost: vs.similarity_boost,
        style: vs.style,
        speed: vs.speed,
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
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[ComedyReel] preview-script failed:", err.message);
    return NextResponse.json({ error: err.message || "Preview failed" }, { status: 500 });
  }
}
