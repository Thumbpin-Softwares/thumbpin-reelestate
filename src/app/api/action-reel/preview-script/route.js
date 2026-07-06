import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { fal } from "@fal-ai/client";
import { synthesizeVoice } from "@/lib/voice-tts";
import { hasSufficientCreditsForAction } from "@/lib/credit-system";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const MAX_PREVIEW_CHARS = 600;

/**
 * POST /api/action-reel/preview-script
 *
 * Previews the user's ACTUAL typed script text (unlike /api/veo-long-ad/preview-voice,
 * which only plays a canned per-language sample sentence). Fully ephemeral — no R2
 * upload, no DB writes — but DOES require the user to be able to afford an Action
 * Reel generation (read-only check, no deduction here) so a 0-credit user can't
 * burn real ElevenLabs/Sarvam TTS calls on previews they could never actually render.
 */
export async function POST(request) {
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
    action: "action_reel_video",
  });
  if (!affordability.ok) {
    return NextResponse.json(affordability.payload, { status: affordability.status });
  }

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
