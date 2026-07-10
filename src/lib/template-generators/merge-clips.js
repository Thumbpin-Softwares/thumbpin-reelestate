import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import crypto from "crypto";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";

ffmpeg.setFfmpegPath(ffmpegPath);

async function downloadToFile(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

// Phase 5: concatenates the already lip-synced clips (each one already has
// its own narration baked in from Phase 4.2) into one master vertical MP4.
// No separate voiceover/mux pass here anymore — that's what Phase 4.2 was
// for, per-frame. This step is pure video+audio concatenation, via
// fluent-ffmpeg (server-side; the FFmpeg-WASM path in lib/video-combiner.js
// is browser-only and can't run inside an API route).
export async function mergeClips(clips, { userId = "template" } = {}) {
  if (!Array.isArray(clips) || clips.length === 0) throw new Error("No clips to merge");

  // A single clip has nothing to concatenate — skip ffmpeg entirely and
  // just re-host it under our own storage so the caller always gets back a
  // stable URL regardless of TEST_MODE_LIMIT / frame count.
  if (clips.length === 1) {
    const res = await fetch(clips[0].videoUrl);
    if (!res.ok) throw new Error(`Failed to download ${clips[0].videoUrl}: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const key = buildUserKey(userId, "template-reels", "mp4", "template-reel");
    const videoUrl = await uploadToR2(buffer, key, "video/mp4");
    return { videoUrl };
  }

  const id = crypto.randomUUID();
  const dir = tmpdir();
  const clipPaths = clips.map((_, i) => join(dir, `template-clip-${id}-${i}.mp4`));
  const outputPath = join(dir, `template-final-${id}.mp4`);

  try {
    await Promise.all(clips.map((c, i) => downloadToFile(c.videoUrl, clipPaths[i])));

    await new Promise((resolve, reject) => {
      const command = ffmpeg();
      clipPaths.forEach((p) => command.input(p));
      command
        .outputOptions(["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"])
        .on("error", reject)
        .on("end", resolve)
        .mergeToFile(outputPath, dir);
    });

    const finalBuffer = await readFile(outputPath);
    const key = buildUserKey(userId, "template-reels", "mp4", "template-reel");
    const videoUrl = await uploadToR2(finalBuffer, key, "video/mp4");

    return { videoUrl };
  } finally {
    await Promise.all([
      ...clipPaths.map((p) => unlink(p).catch(() => {})),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}
