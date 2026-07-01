import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { synthesizeVoice } from "@/lib/voice-tts";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const MAX_PREVIEW_CHARS = 600;

/**
 * POST /api/action-reel/preview-script
 *
 * Previews the user's ACTUAL typed script text (unlike /api/veo-long-ad/preview-voice,
 * which only plays a canned per-language sample sentence). Fully ephemeral — no R2
 * upload, no DB writes, no credit charge — since this text gets re-synthesized after
 * the 2-way split + localization anyway.
 */
export async function POST(request) {
  const { text, voiceId, language } = await request.json();
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!voiceId) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }

  const previewText = text.trim().slice(0, MAX_PREVIEW_CHARS);

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
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[ActionReel] preview-script failed:", err.message);
    return NextResponse.json({ error: err.message || "Preview failed" }, { status: 500 });
  }
}
