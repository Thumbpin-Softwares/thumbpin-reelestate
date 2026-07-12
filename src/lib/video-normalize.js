import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import crypto from "crypto";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

/**
 * Re-encodes a video buffer with a short, fixed keyframe interval.
 *
 * Why: the editor's Cut tool re-bases each surviving chunk of a clip to
 * start at an arbitrary mid-clip frame (see SeedanceReelComposition /
 * ActionReelComposition). Exporting then uses Remotion's OffthreadVideo to
 * seek straight to that frame — if the source video's nearest keyframe is
 * far away (the default for most AI-generation providers, which optimize
 * for streaming, not scrubbing), that seek can come back with a black frame.
 * A keyframe every ~0.5s (15 frames @ 30fps) means any seek point Remotion
 * asks for is always close to one, eliminating the black-frame risk.
 *
 * Only worth paying for on clips that will actually be reopened in the
 * editor (avatar/broll/CTA/part1/part2 sources) — NOT on already-flattened
 * final exports, which are never seeked into again.
 *
 * @param {Buffer} buffer - Input video bytes (any codec ffmpeg can decode)
 * @returns {Promise<Buffer>} Re-encoded H.264 video bytes
 */
export async function normalizeKeyframesForSeeking(buffer) {
  const id = crypto.randomUUID();
  const inPath = join(tmpdir(), `normalize-in-${id}.mp4`);
  const outPath = join(tmpdir(), `normalize-out-${id}.mp4`);

  try {
    await writeFile(inPath, buffer);

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", inPath,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-g", "15",
      "-keyint_min", "15",
      "-sc_threshold", "0",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outPath,
    ]);

    return await readFile(outPath);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
