export const maxDuration = 300;

import { NextResponse } from "next/server";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync, unlinkSync } from "fs";

let cachedBundleUrl = null;

async function getBundle() {
  if (cachedBundleUrl) return cachedBundleUrl;
  cachedBundleUrl = await bundle({
    entryPoint: join(process.cwd(), "src/lib/remotion/index.jsx"),
    webpackOverride: (cfg) => cfg,
  });
  return cachedBundleUrl;
}

// Shared re-export endpoint for the "isFlatExport" EDITABLE_SOURCES entries
// (see src/lib/editable-sources.js) — reopening an already-exported reel is
// always a single-clip "ActionReel" composition (part1 only), regardless of
// which original pipeline produced it, so one generic route covers all of
// them instead of duplicating each pipeline's render-remotion route.
export async function POST(request) {
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user._id.toString();

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

      const outputPath = join(tmpdir(), `video-export-${Date.now()}.mp4`);

      send({ type: "status", message: "Rendering frames…" });
      const { trimInFrame, trimOutFrame, ...compositionInputProps } = inputProps;
      const frameRange = (
        typeof trimInFrame === "number" && typeof trimOutFrame === "number" &&
        (trimInFrame > 0 || trimOutFrame < composition.durationInFrames)
      ) ? [trimInFrame, trimOutFrame - 1] : undefined;

      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: compositionInputProps,
        chromiumOptions: { disableWebSecurity: true },
        x264Preset: "ultrafast",
        concurrency: 4,
        ...(frameRange ? { frameRange } : {}),
        onProgress: ({ progress }) => {
          send({ type: "progress", progress: Math.round(progress * 100) });
        },
      });

      send({ type: "status", message: "Uploading…" });
      const videoBuf = readFileSync(outputPath);
      try { unlinkSync(outputPath); } catch (_) {}

      const key = buildUserKey(userId, "videos", "mp4", `video-export-${Date.now()}`);
      // This export is itself an EDITABLE_SOURCE (isFlatExport) — it can be
      // reopened and cut again, so it needs the same keyframe normalization
      // as the original generation pipelines (see video-normalize.js) rather
      // than libx264's default sparse GOP.
      const url = await uploadToR2(videoBuf, key, "video/mp4", { normalizeKeyframes: true });

      // Tagged as "video-export" (not the original pipeline's own "-export"
      // source) so re-exporting an already-reopened export stays editable
      // the same way, every time — always a fresh edit, never resuming the
      // draft that produced it (each export is a brand-new Asset id).
      try {
        await dbConnect();
        await Asset.create({
          userId,
          name: `Video (exported) — ${new Date().toLocaleDateString()}`,
          url,
          type: "video",
          metadata: { source: "video-export", exportedFrom: inputProps.source || "video-export" },
        });
      } catch (dbErr) {
        console.error("[exports render-remotion] DB save error:", dbErr);
      }

      send({ type: "done", url });
    } catch (err) {
      console.error("[exports render-remotion] Error:", err);
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
