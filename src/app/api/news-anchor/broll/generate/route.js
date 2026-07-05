export const maxDuration = 300;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey, extFromMime } from "@/lib/r2-upload";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, getVideoMetadata } from "@remotion/renderer";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import sharp from "sharp";

/**
 * POST /api/news-anchor/broll/generate
 *
 * Pure-media B-roll render: no AI, no TTS. Uploads the user's ordered
 * photos/videos (+ optional music) to R2, probes video durations, then
 * renders the "NewsAnchorBroll" Remotion composition server-side with the
 * exact same component the <Player> preview uses, so preview == output.
 */

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
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found." }), { status: 404 });
  }
  const userId = user._id.toString();

  const formData = await request.formData();
  const presetId = (formData.get("presetId") || "cinematic").toString();
  const count = parseInt(formData.get("count") || "0", 10);

  if (!count || count < 1) {
    return new Response(JSON.stringify({ error: "At least one media item is required" }), { status: 400 });
  }

  const items = [];
  for (let i = 0; i < count; i++) {
    const file = formData.get(`media_${i}`);
    const type = (formData.get(`mediaType_${i}`) || "image").toString();
    if (!file || typeof file === "string") continue;
    items.push({ file, type, index: i });
  }

  const musicFile = formData.get("music");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data) {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch (_) {}
      }

      try {
        send({ type: "status", message: "Uploading media…" });

        const mediaItems = new Array(items.length);
        let uploaded = 0;

        await Promise.all(
          items.map(async ({ file, type, index }, pos) => {
            const buf = Buffer.from(await file.arrayBuffer());

            if (type === "video") {
              const tempPath = join(tmpdir(), `nanchor-broll-src-${Date.now()}-${pos}.mp4`);
              writeFileSync(tempPath, buf);
              let durationSeconds = 0;
              try {
                const meta = await getVideoMetadata(tempPath);
                durationSeconds = meta.durationInSeconds || 0;
              } catch (e) {
                console.warn("[NewsAnchor/Broll] Could not probe video duration:", e.message);
              } finally {
                try { unlinkSync(tempPath); } catch (_) {}
              }

              const key = buildUserKey(userId, "videos", "mp4", `nanchor-broll-vid-${pos}`);
              const url = await uploadToR2(buf, key, "video/mp4");
              mediaItems[pos] = { url, type: "video", durationSeconds: durationSeconds || 4 };
            } else {
              const cropped = await sharp(buf)
                .resize(1080, 1920, { fit: "cover", position: "centre" })
                .jpeg({ quality: 88 })
                .toBuffer();
              const key = buildUserKey(userId, "images", "jpg", `nanchor-broll-img-${pos}`);
              const url = await uploadToR2(cropped, key, "image/jpeg");
              mediaItems[pos] = { url, type: "image" };
            }

            uploaded += 1;
            send({ type: "upload_progress", uploaded, total: items.length });
          }),
        );

        let musicUrl = "";
        if (musicFile && typeof musicFile !== "string") {
          try {
            const buf = Buffer.from(await musicFile.arrayBuffer());
            const ext = extFromMime(musicFile.type) || "mp3";
            const key = buildUserKey(userId, "audio", ext, "nanchor-broll-music");
            musicUrl = await uploadToR2(buf, key, musicFile.type || "audio/mpeg");
          } catch (e) {
            console.warn("[NewsAnchor/Broll] Music upload failed:", e.message);
          }
        }

        send({ type: "status", message: "Bundling Remotion project…" });
        const serveUrl = await getBundle();

        send({ type: "status", message: "Preparing composition…" });
        const inputProps = { mediaItems, presetId, musicUrl };
        const composition = await selectComposition({
          serveUrl,
          id: "NewsAnchorBroll",
          inputProps,
        });

        const outputPath = join(tmpdir(), `nanchor-broll-${Date.now()}.mp4`);

        send({ type: "status", message: "Rendering frames…" });
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          outputLocation: outputPath,
          inputProps,
          chromiumOptions: { disableWebSecurity: true },
          x264Preset: "ultrafast",
          concurrency: 4,
          onProgress: ({ progress }) => {
            send({ type: "progress", progress: Math.round(progress * 100) });
          },
        });

        send({ type: "status", message: "Uploading final video…" });
        const videoBuf = readFileSync(outputPath);
        try { unlinkSync(outputPath); } catch (_) {}

        const finalKey = buildUserKey(userId, "videos", "mp4", "nanchor-broll-final");
        const url = await uploadToR2(videoBuf, finalKey, "video/mp4");

        try {
          await dbConnect();
          await Asset.create({
            userId,
            name: `News Anchor B-roll — ${new Date().toLocaleDateString()}`,
            url,
            type: "clip",
            metadata: { source: "news-anchor-broll", presetId },
          });
        } catch (dbErr) {
          console.error("[NewsAnchor/Broll] Asset save failed:", dbErr.message);
        }

        send({ type: "done", url });
      } catch (err) {
        console.error("[NewsAnchor/Broll] Error:", err);
        send({ type: "error", message: err.message || "B-roll render failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
