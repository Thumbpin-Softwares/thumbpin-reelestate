export const maxDuration = 300;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync, unlinkSync } from "fs";

// Bundle is expensive to create — cache it across requests in the same process.
let cachedBundleUrl = null;

async function getBundle() {
  if (cachedBundleUrl) return cachedBundleUrl;
  cachedBundleUrl = await bundle({
    entryPoint: join(process.cwd(), "src/lib/remotion/index.jsx"),
    webpackOverride: (cfg) => cfg,
  });
  return cachedBundleUrl;
}

// renderMedia() fetches each remote video URL fresh when OffthreadVideo's
// frame extractor opens a new clip — a transient connection blip there
// ("Could not extract frame from compositor") shouldn't fail the whole job
// when both source videos already exist and cost nothing to re-stitch.
async function renderMediaWithRetry(params, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await renderMedia(params);
    } catch (err) {
      lastErr = err;
      console.warn(
        `[comedy-reel render-remotion] renderMedia attempt ${i + 1}/${attempts} failed:`,
        err.message,
      );
    }
  }
  throw lastErr;
}

/**
 * POST /api/comedy-reel/render-remotion
 *
 * Body (JSON): part1VideoUrl, part2VideoUrl, part1Duration, part2Duration
 * Returns: { url } — final MP4 on R2
 *
 * Reuses the "ActionReel" Remotion composition — comedy-reel's output shape
 * (two baked-audio clips, hard cut, no overlay audio) is identical to
 * action-reel's, so no separate composition is needed.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?._id || "anon";

  const inputProps = await request.json();

  try {
    const serveUrl = await getBundle();

    const composition = await selectComposition({
      serveUrl,
      id: "ActionReel",
      inputProps,
    });

    const outputPath = join(tmpdir(), `comedy-reel-${Date.now()}.mp4`);

    await renderMediaWithRetry({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: {
        disableWebSecurity: true,
      },
      x264Preset: "fast",
      onProgress: () => {},
    });

    const videoBuf = readFileSync(outputPath);
    try { unlinkSync(outputPath); } catch (_) {}

    const key = buildUserKey(userId, "videos", "mp4", `comedy-final-${Date.now()}`);
    const url = await uploadToR2(videoBuf, key, "video/mp4");

    return Response.json({ url });
  } catch (err) {
    console.error("[comedy-reel render-remotion] Error:", err);
    return Response.json({ error: err.message || "Render failed" }, { status: 500 });
  }
}
