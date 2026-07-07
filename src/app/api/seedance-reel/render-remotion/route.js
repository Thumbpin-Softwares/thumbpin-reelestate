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

      const outputPath = join(tmpdir(), `seedance-reel-${Date.now()}.mp4`);

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

      const key = buildUserKey(userId, "videos", "mp4", `sreel-final-${Date.now()}`);
      const url = await uploadToR2(videoBuf, key, "video/mp4");

      // Save the final exported/combined reel as its own asset so it shows up
      // in "My Videos" — metadata.source deliberately isn't an EDITABLE_SOURCES
      // key (it's a flattened mp4, not reopenable as a Remotion composition).
      try {
        await dbConnect();
        await Asset.create({
          userId,
          name: `Seedance Reel (exported) — ${new Date().toLocaleDateString()}`,
          url,
          type: "video",
          metadata: { source: "seedance-reel-export", exportedFrom: "seedance-reel" },
        });
      } catch (dbErr) {
        console.error("[seedance-reel render-remotion] DB save error:", dbErr);
      }

      send({ type: "done", url });
    } catch (err) {
      console.error("[render-remotion] Error:", err);
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
