/**
 * Ken Burns + Stock B-Roll generator — runs entirely in the browser via FFmpeg WASM.
 *
 * Accepts a mixed array of items:
 *   { type: "photo", file?, url, name? }  → Ken Burns pan L→R + zoom
 *   { type: "video", url, duration? }     → scale/crop landscape → portrait, trim
 *
 * Pipeline:
 *   Pass 1 — convert each item to a normalised 1080×1920 clip.
 *   Pass 2 — chain all clips with xfade crossfade dissolve.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

async function loadFFmpeg(onLog) {
  const ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));
  const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg;
}

// ── Filter builders ──────────────────────────────────────────────────────────

function kenBurnsFilter(durationSec) {
  const fps = 25;
  const frames = Math.max(Math.round(durationSec * fps), 2);
  const zoom = 1.25;
  // Scale input to 1350×2400 (25% wider than output) so pan has room.
  // Visible crop at zoom=1.25: 1080×1920. maxPanX = 1350 − 1080 = 270 px.
  const maxPanX = 270;
  const pxPerFrame = (maxPanX / frames).toFixed(4);
  const fadeF = Math.min(8, Math.floor(frames * 0.12));
  const fadeSec = (fadeF / fps).toFixed(2);
  const fadeOutSec = ((frames - fadeF) / fps).toFixed(2);

  return [
    "scale=1350:2400:force_original_aspect_ratio=increase",
    "crop=1350:2400",
    `zoompan=z=${zoom}:x='on*${pxPerFrame}':y='(ih-ih/${zoom})/2':d=${frames + 1}:s=1080x1920:fps=${fps}`,
    `fade=t=in:st=0:d=${fadeSec}`,
    `fade=t=out:st=${fadeOutSec}:d=${fadeSec}`,
  ].join(",");
}

function stockVideoFilter(durationSec) {
  // Landscape (16:9) → portrait (9:16): scale up so height=1920, then center-crop to 1080 wide.
  const fadeSec = "0.30";
  const fadeOutSec = Math.max(durationSec - 0.3, 0.1).toFixed(2);
  return [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    `fade=t=in:st=0:d=${fadeSec}`,
    `fade=t=out:st=${fadeOutSec}:d=${fadeSec}`,
  ].join(",");
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a Ken Burns + stock B-roll slideshow video.
 *
 * @param {Array} items
 *   Each item is one of:
 *     { type: "photo", file?: File, url?: string, name?: string }
 *     { type: "video", url: string, duration?: number }
 *   Legacy (no type): treated as "photo".
 *
 * @param {object} opts
 * @param {number}   opts.durationPerPhoto  seconds per user photo (default 5)
 * @param {number}   opts.durationPerVideo  max seconds to use from each stock clip (default 5)
 * @param {number}   opts.fadeDuration      xfade cross-dissolve length in s (default 0.5)
 * @param {function} opts.onProgress        (message: string) => void
 * @param {function} opts.onLog             raw FFmpeg log line callback
 *
 * @returns {Promise<{blobUrl: string, blob: Blob}>}
 */
export async function generateKenBurnsVideo(items, opts = {}) {
  const {
    durationPerPhoto = 5,
    durationPerVideo = 5,
    fadeDuration = 0.5,
    onProgress,
    onLog,
  } = opts;

  if (!items || items.length === 0) throw new Error("No items provided");

  onProgress?.("Loading FFmpeg engine…");
  const ffmpeg = await loadFFmpeg(onLog);

  // Normalise: legacy items without type default to "photo"
  const normalised = items.map((it) => ({
    ...it,
    type: it.type ?? "photo",
  }));

  try {
    const clipNames = [];
    const clipDurations = []; // track actual duration per clip for xfade offsets

    // ── Pass 1: convert each item to a 1080×1920 clip ────────────────────────
    for (let i = 0; i < normalised.length; i++) {
      const item = normalised[i];
      const clipFile = `kb_clip${i}.mp4`;

      if (item.type === "photo") {
        // ── Photo: Ken Burns animation ──────────────────────────────────────
        onProgress?.(`Animating photo ${i + 1}/${normalised.length}…`);

        const src = item.file ?? item.url;
        if (!src) continue;

        const rawName =
          item.name ??
          (typeof item.url === "string" ? item.url.split("?")[0] : "") ??
          "img.jpg";
        const ext = rawName.split(".").pop().toLowerCase() || "jpg";
        const imgFile = `kb_img${i}.${ext}`;

        const data = await fetchFile(src);
        await ffmpeg.writeFile(imgFile, data);

        let vf = kenBurnsFilter(durationPerPhoto);
        let succeeded = false;

        try {
          await ffmpeg.exec([
            "-loop", "1",
            "-framerate", "25",
            "-i", imgFile,
            "-t", String(durationPerPhoto),
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-an",
            clipFile,
          ]);
          succeeded = true;
        } catch {
          // zoompan unavailable — fall back to static + fades
        }

        if (!succeeded) {
          const fadeF = Math.min(8, Math.floor(Math.round(durationPerPhoto * 25) * 0.12));
          const fadeSec = (fadeF / 25).toFixed(2);
          const fadeOutSec = ((Math.round(durationPerPhoto * 25) - fadeF) / 25).toFixed(2);
          vf = [
            "scale=1080:1920:force_original_aspect_ratio=increase",
            "crop=1080:1920",
            `fade=t=in:st=0:d=${fadeSec}`,
            `fade=t=out:st=${fadeOutSec}:d=${fadeSec}`,
          ].join(",");
          await ffmpeg.exec([
            "-loop", "1",
            "-framerate", "25",
            "-i", imgFile,
            "-t", String(durationPerPhoto),
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-an",
            clipFile,
          ]);
        }

        clipDurations.push(durationPerPhoto);

      } else {
        // ── Stock video: scale → portrait, trim ─────────────────────────────
        onProgress?.(`Processing stock clip ${i + 1}/${normalised.length}…`);

        const stockFile = `kb_stock${i}.mp4`;
        try {
          const data = await fetchFile(item.url);
          await ffmpeg.writeFile(stockFile, data);
        } catch (fetchErr) {
          console.warn(`[KenBurns] Could not fetch stock clip ${i}: ${fetchErr.message}. Skipping.`);
          continue;
        }

        const useDuration = Math.min(item.duration || durationPerVideo, durationPerVideo);
        const vf = stockVideoFilter(useDuration);

        await ffmpeg.exec([
          "-i", stockFile,
          "-t", String(useDuration),
          "-vf", vf,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-pix_fmt", "yuv420p",
          "-an",
          clipFile,
        ]);

        clipDurations.push(useDuration);
      }

      clipNames.push(clipFile);
    }

    if (clipNames.length === 0) throw new Error("No clips were generated.");

    // ── Pass 2: xfade chain join ──────────────────────────────────────────────
    let outputFile;

    if (clipNames.length === 1) {
      outputFile = clipNames[0];
    } else {
      onProgress?.("Blending clips with crossfade…");

      const inputArgs = clipNames.flatMap((name) => ["-i", name]);
      const filterParts = [];
      let prevLabel = "0:v";
      let offset = 0;

      for (let i = 0; i < clipNames.length - 1; i++) {
        const nextInput = `${i + 1}:v`;
        const outLabel = i === clipNames.length - 2 ? "vout" : `vt${i + 1}`;
        // Offset = cumulative "effective" duration (actual duration minus fade overlap)
        offset += clipDurations[i] - fadeDuration;
        filterParts.push(
          `[${prevLabel}][${nextInput}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset.toFixed(2)}[${outLabel}]`
        );
        prevLabel = outLabel;
      }

      outputFile = "kb_output.mp4";
      await ffmpeg.exec([
        ...inputArgs,
        "-filter_complex", filterParts.join(";"),
        "-map", "[vout]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outputFile,
      ]);
    }

    onProgress?.("Finalizing…");
    const outData = await ffmpeg.readFile(outputFile);
    const blob = new Blob([outData.buffer], { type: "video/mp4" });
    return { blobUrl: URL.createObjectURL(blob), blob };

  } finally {
    ffmpeg.terminate?.();
  }
}
