export const maxDuration = 300;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync, unlinkSync } from "fs";
import { calcDurationInFrames } from "@/lib/remotion/duration";

// Bundle is expensive to create — cache it across requests in the same process.
let cachedBundleUrl = null;

async function getBundle() {
  if (cachedBundleUrl) return cachedBundleUrl;
  cachedBundleUrl = await bundle({
    entryPoint: join(process.cwd(), "src/lib/remotion/index.jsx"),
    // Allow cross-origin video/audio URLs loaded inside Chromium
    webpackOverride: (cfg) => cfg,
  });
  return cachedBundleUrl;
}

/**
 * POST /api/seedance-reel/render-remotion
 *
 * Body (JSON):
 *   avatarVideoUrl, walkthroughVideoUrl, ctaVideoUrl, part2AudioUrl
 *   avatarDuration, walkthroughAudioDuration, walkthroughVideoDuration, ctaDuration
 *   ctaText
 *
 * Returns: { url } — final MP4 on R2 (or a signed blob URL as fallback)
 */
export async function POST(request) {
  // Auth
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?._id || "anon";

  const inputProps = await request.json();
  const {
    avatarDuration = 15,
    brollClips     = [],
    ctaDuration    = 10,
  } = inputProps;

  const durationInFrames = calcDurationInFrames({
    avatarDuration,
    brollClips,
    ctaDuration,
    fps: 30,
  });

  try {
    const serveUrl = await getBundle();

    const composition = await selectComposition({
      serveUrl,
      id: "SeedanceReel",
      inputProps,
      // Override duration to match actual video lengths
      durationInFrames,
    });

    const outputPath = join(tmpdir(), `seedance-reel-${Date.now()}.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: {
        disableWebSecurity: true, // allow cross-origin R2 video/audio URLs
      },
      x264Preset: "fast",
      onProgress: () => {}, // no-op — we don't stream progress for this route
    });

    const videoBuf = readFileSync(outputPath);
    try { unlinkSync(outputPath); } catch (_) {}

    const key = buildUserKey(userId, "videos", "mp4", `sreel-final-${Date.now()}`);
    const url = await uploadToR2(videoBuf, key, "video/mp4");

    return Response.json({ url });
  } catch (err) {
    console.error("[render-remotion] Error:", err);
    return Response.json({ error: err.message || "Render failed" }, { status: 500 });
  }
}
