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

/**
 * POST /api/action-reel/render-remotion
 *
 * Body (JSON): part1VideoUrl, part2VideoUrl, part1Duration, part2Duration
 * Returns: { url } — final MP4 on R2
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

    const outputPath = join(tmpdir(), `action-reel-${Date.now()}.mp4`);

    await renderMedia({
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

    const key = buildUserKey(userId, "videos", "mp4", `areel-final-${Date.now()}`);
    const url = await uploadToR2(videoBuf, key, "video/mp4");

    return Response.json({ url });
  } catch (err) {
    console.error("[action-reel render-remotion] Error:", err);
    return Response.json({ error: err.message || "Render failed" }, { status: 500 });
  }
}
