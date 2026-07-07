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
 * Body (JSON): part1VideoUrl, part2VideoUrl, part1Duration, part2Duration,
 *   plus editor additions — overlays, musicUrl, musicTrimStartSeconds,
 *   musicVolume, cutRanges, trimInFrame, trimOutFrame.
 *
 * Streams SSE progress events ({ type: "status"|"progress"|"done"|"error" })
 * so it can be driven by the shared /app/edit Editor the same way
 * seedance-reel's render-remotion is. Reuses the "ActionReel" Remotion
 * composition — comedy-reel's output shape (two baked-audio clips, hard cut)
 * is identical to action-reel's, so no separate composition is needed.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?._id || "anon";
  const inputProps = await request.json();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const send = (obj) => {
    try { writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch (_) {}
  };

  (async () => {
    try {
      send({ type: "status", message: "Bundling…" });
      const serveUrl = await getBundle();

      send({ type: "status", message: "Preparing composition…" });
      const composition = await selectComposition({
        serveUrl,
        id: "ActionReel",
        inputProps,
      });

      const outputPath = join(tmpdir(), `comedy-reel-${Date.now()}.mp4`);

      send({ type: "status", message: "Rendering frames…" });
      const { trimInFrame, trimOutFrame, ...compositionInputProps } = inputProps;
      const frameRange = (
        typeof trimInFrame === "number" && typeof trimOutFrame === "number" &&
        (trimInFrame > 0 || trimOutFrame < composition.durationInFrames)
      ) ? [trimInFrame, trimOutFrame - 1] : undefined;

      await renderMediaWithRetry({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: compositionInputProps,
        chromiumOptions: { disableWebSecurity: true },
        x264Preset: "fast",
        ...(frameRange ? { frameRange } : {}),
        onProgress: ({ progress }) => {
          send({ type: "progress", progress: Math.round(progress * 100) });
        },
      });

      send({ type: "status", message: "Uploading…" });
      const videoBuf = readFileSync(outputPath);
      try { unlinkSync(outputPath); } catch (_) {}

      const key = buildUserKey(userId, "videos", "mp4", `comedy-final-${Date.now()}`);
      const url = await uploadToR2(videoBuf, key, "video/mp4");

      send({ type: "done", url });
    } catch (err) {
      console.error("[comedy-reel render-remotion] Error:", err);
      send({ type: "error", error: err.message || "Render failed" });
    } finally {
      try { writer.close(); } catch (_) {}
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
