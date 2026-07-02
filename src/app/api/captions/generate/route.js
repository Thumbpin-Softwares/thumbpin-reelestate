export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { fal } from "@fal-ai/client";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?._id || "anon";

  const { videoUrl, preset, language, translationLanguage, position } = await request.json();
  if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  if (!preset) return NextResponse.json({ error: "preset is required" }, { status: 400 });
  if (!process.env.FAL_KEY) return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });

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

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[captions/generate] Error:", err.message, JSON.stringify(err.body ?? err, null, 2));
    const detail = err.body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => `${d.loc?.join(".")}: ${d.msg}`).join("; ")
      : (detail || err.message || "Caption generation failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
