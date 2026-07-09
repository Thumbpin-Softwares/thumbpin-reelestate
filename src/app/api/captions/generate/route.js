export const maxDuration = 300;

import { NextResponse } from "next/server";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import { computeCaptionCreditCost, CAPTION_FAILED_RUN_CHARGE_CREDITS } from "@/lib/credit-costs";
import { CAPTION_PRESETS } from "@/lib/remotion/caption-presets";
import { fal } from "@fal-ai/client";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export async function POST(request) {
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user._id.toString();

  const { videoUrl, preset, language, translationLanguage, position, durationSeconds } =
    await request.json();
  if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  if (!preset) return NextResponse.json({ error: "preset is required" }, { status: 400 });
  if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });

  const presetConfig = CAPTION_PRESETS.find((p) => p.id === preset);
  if (!presetConfig) return NextResponse.json({ error: "Unknown caption preset" }, { status: 400 });

  // Usage-based pricing: $0.10/min, ×2 for >1080p, ×2 for dynamic presets, +$0.20/min
  // for translation — ×10 margin, converted to credits at the $1 = 480 credits peg.
  // durationSeconds comes from the reel's own composition (durationInFrames / fps),
  // not an arbitrary client value, so it's trustworthy for pricing purposes.
  const { credits: creditsCost } = computeCaptionCreditCost({
    durationSeconds: Number(durationSeconds) || 0,
    isDynamicPreset: presetConfig.tier === "dynamic",
    hasTranslation: !!translationLanguage,
  });

  const creditResult = await consumeCreditsForAction({
    userId,
    action: "captions_generation",
    costOverride: creditsCost,
    metadata: { endpoint: "/api/captions/generate", preset, durationSeconds, translationLanguage },
  });
  if (!creditResult.ok) {
    return NextResponse.json(creditResult.payload, { status: creditResult.status });
  }
  const debit = creditResult.debit;

  try {
    const result = await fal.subscribe("veed/subtitles", {
      input: {
        video_url: videoUrl,
        preset,
        ...(language ? { language } : {}),
        ...(translationLanguage ? { translation_language: translationLanguage } : {}),
        ...(position ? { customization: { position } } : {}),
      },
      logs: false,
    });

    const falVideoUrl = result?.data?.video?.url;
    if (!falVideoUrl) throw new Error("VEED returned no video URL");

    const videoRes = await fetch(falVideoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download captioned video: ${videoRes.status}`);
    const videoBuf = Buffer.from(await videoRes.arrayBuffer());

    const key = buildUserKey(userId, "videos", "mp4", `captions-${preset}-${Date.now()}`);
    const url = await uploadToR2(videoBuf, key, "video/mp4");

    // Save the captioned/exported video as its own asset so it shows up in
    // "My Videos" — metadata.source deliberately isn't an EDITABLE_SOURCES key
    // (it's a flattened mp4 with captions burned in, not reopenable as a
    // Remotion composition).
    try {
      await dbConnect();
      await Asset.create({
        userId,
        name: `Captioned Reel (${presetConfig.label}) — ${new Date().toLocaleDateString()}`,
        url,
        type: "video",
        metadata: { source: "captions-export", preset },
      });
    } catch (dbErr) {
      console.error("[captions/generate] DB save error:", dbErr);
    }

    return NextResponse.json({ url, creditsCharged: creditsCost });
  } catch (err) {
    console.error("[captions/generate] Error:", err.message, JSON.stringify(err.body ?? err, null, 2));
    // VEED still bills us for the attempt even when it fails, so only refund
    // the margin — keep a flat raw-cost charge instead of a full refund.
    const chargeOnFailure = Math.min(CAPTION_FAILED_RUN_CHARGE_CREDITS, creditsCost);
    const refundAmount = Math.max(0, creditsCost - chargeOnFailure);
    await refundCreditsForAction({
      userId,
      action: "captions_generation",
      debit,
      amount: refundAmount,
      metadata: { endpoint: "/api/captions/generate", reason: "generation_failed", message: err.message, chargeOnFailure },
    });
    const detail = err.body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => `${d.loc?.join(".")}: ${d.msg}`).join("; ")
      : (detail || err.message || "Caption generation failed");
    return NextResponse.json({ error: message, creditsCharged: chargeOnFailure }, { status: 500 });
  }
}
