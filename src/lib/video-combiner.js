/**
 * Client-side video combiner using FFmpeg WASM
 * Combines multiple video clips into one with simple concatenation.
 * Runs entirely in the browser — no server-side FFmpeg needed.
 *
 * Fix: always create a fresh FFmpeg instance per call to avoid
 * virtual FS state corruption ("ErrnoError: FS error") across invocations.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

/**
 * Load a fresh FFmpeg WASM instance (single-threaded core).
 * We do NOT cache the instance — a dirty FS causes ErrnoError on reuse.
 */
async function loadFreshFFmpeg(onLog) {
  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }

  // Single-threaded core from CDN — no COOP/COEP headers required
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

function isImageUrl(url) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif)$/.test(clean);
}

/**
 * Parse a WAV buffer (Uint8Array) and return its duration in seconds.
 * Walks the RIFF chunk list to find the "data" chunk rather than assuming
 * a fixed 44-byte header — some WAV encoders insert extra chunks before data.
 */
function getWavDurationSeconds(data) {
  try {
    // fetchFile returns Uint8Array; wrap in DataView for typed reads
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    // Must start with "RIFF" ... "WAVE"
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    if (riff !== "RIFF" || wave !== "WAVE") return null;

    // fmt chunk is always first — read audio params at known offsets
    const sampleRate   = view.getUint32(24, true);
    const channels     = view.getUint16(22, true);
    const bitsPerSample = view.getUint16(34, true);
    const bytesPerSec  = sampleRate * channels * (bitsPerSample / 8);
    if (bytesPerSec <= 0) return null;

    // Walk chunks starting after "WAVE" (offset 12)
    let offset = 12;
    while (offset + 8 <= view.byteLength) {
      const id   = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
      const size = view.getUint32(offset + 4, true);
      if (id === "data") {
        return size / bytesPerSec;
      }
      offset += 8 + size + (size & 1); // RIFF chunks are word-aligned
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Combine multiple video URLs into a single video.
 * If audioUrls[i] is provided for a clip, that audio is mixed into the clip
 * before concatenation (voiceover / TTS overlay).
 *
 * @param {string[]} videoUrls         - Array of video URLs to combine
 * @param {object}   options
 * @param {function} options.onProgress - Progress callback (message: string)
 * @param {function} options.onLog      - FFmpeg log callback
 * @param {number[]} options.durations  - Per-clip max duration (outpoint trimming)
 * @param {Array}    options.audioUrls  - Parallel audio URLs (null where no audio)
 * @returns {Promise<{ blobUrl: string, blob: Blob }>}
 */
export async function combineVideos(videoUrls, options = {}) {
  const { onProgress, onLog, durations, audioUrls, fullAudioUrl } = options;
  const logs = [];

  const internalLog = (msg) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    if (onLog) onLog(msg);
    console.log("[VideoCombiner]", msg);
  };

  if (!videoUrls || videoUrls.length === 0) {
    throw new Error("No video URLs provided");
  }

  // Single video with no audio at all — return directly without loading FFmpeg
  if (videoUrls.length === 1 && !audioUrls?.[0] && !fullAudioUrl) {
    onProgress?.("Fetching video...");
    internalLog(`Single video detected. Fetching ${videoUrls[0]}`);
    const response = await fetch(videoUrls[0]);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
    const blob = await response.blob();
    return { blobUrl: URL.createObjectURL(blob), blob, logs };
  }

  onProgress?.("Loading FFmpeg engine...");
  internalLog("Initializing FFmpeg WASM...");

  // Fresh instance every time — prevents FS state corruption
  const ffmpeg = await loadFreshFFmpeg((msg) => {
    logs.push(`[FFMPEG] ${msg}`);
    if (onLog) onLog(msg);
  });

  try {
    // Download all clips/images into FFmpeg's virtual FS.
    // Image URLs (from uploaded property photos) are converted to looped video clips.
    for (let i = 0; i < videoUrls.length; i++) {
      onProgress?.(`Downloading clip ${i + 1} of ${videoUrls.length}...`);
      internalLog(`Downloading clip ${i + 1}: ${videoUrls[i]}`);
      try {
        const data = await fetchFile(videoUrls[i]);

        if (isImageUrl(videoUrls[i])) {
          // Fallback static image (Hailuo failed server-side) → plain scale+crop, no animation
          const ext = videoUrls[i].split("?")[0].split(".").pop().toLowerCase();
          const imgFile = `img${i}.${ext}`;
          await ffmpeg.writeFile(imgFile, data);

          const clipDuration = fullAudioUrl ? (durations?.[i] || 5) : (durations?.[i] || 5) + 0.6;
          internalLog(`Converting static image ${i + 1} to ${clipDuration}s clip...`);

          await ffmpeg.exec([
            "-loop", "1",
            "-framerate", "25",
            "-i", imgFile,
            "-t", String(clipDuration),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-profile:v", "baseline",
            "-level", "3.1",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-an",
            `input${i}.mp4`,
          ]);
          internalLog(`Image ${i + 1} converted to static video.`);
        } else {
          // Strip audio from Hailuo/animated clips.
          // If durations[i] is set (proportional B-roll mode), loop the clip to fill the
          // target duration — Hailuo clips are typically 5–8s but Part 2 audio can be 30–40s.
          await ffmpeg.writeFile(`raw${i}.mp4`, data);
          const targetDur = durations?.[i];
          if (targetDur) {
            internalLog(`Looping clip ${i + 1} to fill ${targetDur}s...`);
            // -stream_loop -1 loops indefinitely; -t stops at targetDur; re-encode for clean timestamps
            await ffmpeg.exec([
              "-stream_loop", "-1",
              "-i", `raw${i}.mp4`,
              "-t", String(targetDur),
              "-c:v", "libx264",
              "-preset", "ultrafast",
              "-profile:v", "baseline",
              "-level", "3.1",
              "-pix_fmt", "yuv420p",
              "-movflags", "+faststart",
              "-an",
              `input${i}.mp4`,
            ]);
            internalLog(`Clip ${i + 1} looped to ${targetDur}s.`);
          } else {
            internalLog(`Stripping audio from clip ${i + 1}...`);
            await ffmpeg.exec([
              "-i", `raw${i}.mp4`,
              "-c:v", "copy",
              "-an",
              `input${i}.mp4`,
            ]);
            internalLog(`Wrote input${i}.mp4 (audio stripped).`);
          }
        }
      } catch (fetchErr) {
        internalLog(`CRITICAL: Failed to download clip ${i + 1}: ${fetchErr.message}`);
        throw new Error(`Failed to fetch clip ${i + 1}: ${fetchErr.message}`);
      }
    }

    // Download audio files and mix into each clip that has one.
    // We parse the WAV duration so FFmpeg trims each merged clip exactly to the
    // speech length — this prevents mid-word cuts when outpoint < audio length.
    const clipFiles = videoUrls.map((_, i) => `input${i}.mp4`);
    const mergedIndices = new Set();
    // Skip per-clip audio mixing when a single full-track audio is provided
    const hasAnyAudio = !fullAudioUrl && audioUrls?.some(Boolean);
    if (hasAnyAudio) {
      onProgress?.("Mixing voiceover into clips...");
      for (let i = 0; i < videoUrls.length; i++) {
        const audioUrl = audioUrls?.[i];
        if (!audioUrl) continue;
        try {
          internalLog(`Downloading audio for clip ${i + 1}: ${audioUrl}`);
          const audioData = await fetchFile(audioUrl);
          // Detect format from URL so FFmpeg demuxer gets the right hint
          const audioExt = audioUrl.split("?")[0].endsWith(".mp3") ? "mp3" : "wav";
          await ffmpeg.writeFile(`audio${i}.${audioExt}`, audioData);

          // WAV duration parsing; returns null for MP3 → falls back to -shortest (safe)
          const audioDuration = audioExt === "wav" ? getWavDurationSeconds(audioData) : null;
          internalLog(`Clip ${i + 1} audio duration: ${audioDuration ?? "unknown"}s`);

          // Silence tail + fade-in/out so beats don't hard-cut or click into each other
          const SILENCE_PAD = 0.38;
          const FADE_DUR = 0.06; // 60ms fade at each end to kill click/pop artifacts
          const trimArgs = audioDuration
            ? ["-t", (audioDuration + SILENCE_PAD).toFixed(3)]
            : ["-shortest"];
          const fadeOutStart = audioDuration ? Math.max(0, audioDuration - FADE_DUR).toFixed(3) : null;
          const audioFilter = audioDuration
            ? ["-af", `afade=t=in:st=0:d=${FADE_DUR},afade=t=out:st=${fadeOutStart}:d=${FADE_DUR},apad=pad_dur=${SILENCE_PAD}`]
            : [];

          internalLog(`Mixing audio into clip ${i + 1}...`);
          await ffmpeg.exec([
            "-i", `input${i}.mp4`,
            "-i", `audio${i}.${audioExt}`,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            ...audioFilter,
            ...trimArgs,
            "-avoid_negative_ts", "make_zero",
            `merged${i}.mp4`,
          ]);
          clipFiles[i] = `merged${i}.mp4`;
          mergedIndices.add(i);
          internalLog(`Clip ${i + 1} audio mixed.`);
        } catch (audioErr) {
          internalLog(`Audio mix failed for clip ${i + 1}: ${audioErr.message}. Using silent clip.`);
        }
      }
    }

    // If only one clip with no full-track audio, return it directly (skip concat overhead)
    if (videoUrls.length === 1 && !fullAudioUrl) {
      const outputData = await ffmpeg.readFile(clipFiles[0]);
      const blob = new Blob([outputData.buffer], { type: "video/mp4" });
      return { blobUrl: URL.createObjectURL(blob), blob, logs };
    }

    onProgress?.("Concatenating clips...");
    internalLog("Creating concat list...");

    // Merged clips are already trimmed to exact audio duration — no outpoint needed.
    // Silent clips still use the beat duration_seconds as outpoint.
    const concatList = clipFiles.map((file, i) => {
      const lines = [`file '${file}'`];
      if (!mergedIndices.has(i) && durations?.[i]) lines.push(`outpoint ${durations[i]}`);
      return lines.join("\n");
    }).join("\n");
    await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(concatList));
    internalLog("concat.txt content:\n" + concatList);

    // Concat with stream copy first (fast, no re-encoding)
    // If streams are incompatible, re-encode with libx264
    try {
      internalLog("Executing FFmpeg (stream copy mode)...");
      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat.txt",
        "-c", "copy",           // stream copy — fastest, no quality loss
        "-movflags", "+faststart",
        "output.mp4",
      ]);
      internalLog("Stream copy finished.");
    } catch (copyErr) {
      // Fallback: re-encode if stream copy fails (e.g. mismatched codecs)
      internalLog(`Stream copy failed: ${copyErr.message}. Falling back to re-encoding...`);
      onProgress?.("Re-encoding for compatibility...");
      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat.txt",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-profile:v", "baseline",
        "-level", "3.1",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "output.mp4",
      ]);
      internalLog("Re-encoding finished.");
    }

    // Apply single full-track audio to the concatenated video (no per-clip mixing)
    if (fullAudioUrl) {
      onProgress?.("Mixing voiceover into final video...");
      internalLog(`Downloading full narration audio: ${fullAudioUrl}`);
      const fullAudioData = await fetchFile(fullAudioUrl);
      const audioExt = fullAudioUrl.split("?")[0].endsWith(".mp3") ? "mp3" : "wav";
      await ffmpeg.writeFile(`full_audio.${audioExt}`, fullAudioData);
      await ffmpeg.exec([
        "-i", "output.mp4",
        "-i", `full_audio.${audioExt}`,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        "output_audio.mp4",
      ]);
      internalLog("Full audio mixed into video.");
    }

    onProgress?.("Finalizing combined video...");
    const finalFile = fullAudioUrl ? "output_audio.mp4" : "output.mp4";
    internalLog(`Reading ${finalFile} from virtual FS...`);

    const outputData = await ffmpeg.readFile(finalFile);
    const blob = new Blob([outputData.buffer], { type: "video/mp4" });
    const blobUrl = URL.createObjectURL(blob);

    internalLog(`Combination successful. Final size: ${blob.size} bytes`);
    onProgress?.("Done!");
    return { blobUrl, blob, logs };

  } catch (err) {
    internalLog(`CRITICAL ERROR: ${err.message}`);
    throw err;
  } finally {
    // Best-effort cleanup of the virtual FS
    internalLog("Cleaning up virtual FS...");
    for (let i = 0; i < videoUrls.length; i++) {
      try { await ffmpeg.deleteFile(`input${i}.mp4`); } catch {}
      try { await ffmpeg.deleteFile(`raw${i}.mp4`); } catch {}
    }
    try { await ffmpeg.deleteFile("output.mp4"); } catch {}
    try { await ffmpeg.deleteFile("concat.txt"); } catch {}
    ffmpeg.terminate?.(); // If available in this version
  }
}

/**
 * Concatenate multiple pre-processed videos that ALL have audio tracks.
 * Unlike combineVideos, this does NOT strip audio — it preserves each clip's
 * existing audio (e.g. Seedance-baked voice for Part 1, ElevenLabs for Part 2).
 *
 * @param {string[]} videoUrls  - Array of video URLs (https or blob:)
 * @param {object}   options
 * @param {function} options.onProgress
 * @param {function} options.onLog
 * @returns {Promise<{ blobUrl: string, blob: Blob }>}
 */
export async function concatWithAudio(videoUrls, options = {}) {
  const { onProgress, onLog } = options;

  if (!videoUrls || videoUrls.length === 0) throw new Error("No video URLs");

  if (videoUrls.length === 1) {
    onProgress?.("Fetching single clip…");
    const res = await fetch(videoUrls[0]);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    return { blobUrl: URL.createObjectURL(blob), blob };
  }

  onProgress?.("Loading FFmpeg for final concat…");
  const ffmpeg = await loadFreshFFmpeg(onLog ? (msg) => onLog(msg) : undefined);

  try {
    for (let i = 0; i < videoUrls.length; i++) {
      onProgress?.(`Downloading clip ${i + 1}/${videoUrls.length}…`);
      const data = await fetchFile(videoUrls[i]);
      await ffmpeg.writeFile(`concat_in${i}.mp4`, data);
    }

    const concatList = videoUrls.map((_, i) => `file 'concat_in${i}.mp4'`).join("\n");
    await ffmpeg.writeFile("concat_audio.txt", new TextEncoder().encode(concatList));

    // Always re-encode to H.264 baseline for universal Apple/iPhone compatibility.
    // Stream copy is skipped because Seedance outputs High profile which Safari/iOS can't decode.
    onProgress?.("Encoding final reel (H.264 baseline)…");
    await ffmpeg.exec([
      "-f", "concat", "-safe", "0", "-i", "concat_audio.txt",
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
      "-profile:v", "baseline", "-level", "3.1",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      "concat_out.mp4",
    ]);

    const outputData = await ffmpeg.readFile("concat_out.mp4");
    const blob = new Blob([outputData.buffer], { type: "video/mp4" });
    onProgress?.("Done!");
    return { blobUrl: URL.createObjectURL(blob), blob };
  } finally {
    for (let i = 0; i < videoUrls.length; i++) {
      try { await ffmpeg.deleteFile(`concat_in${i}.mp4`); } catch {}
    }
    try { await ffmpeg.deleteFile("concat_audio.txt"); } catch {}
    try { await ffmpeg.deleteFile("concat_out.mp4"); } catch {}
    ffmpeg.terminate?.();
  }
}

/**
 * Upload a combined video blob to the server for permanent storage.
 *
 * @param {Blob}   blob     - The combined video blob
 * @param {string} filename - Desired filename
 * @returns {Promise<{ url: string }>} Permanent URL
 */
export async function uploadCombinedVideo(blob, filename = "combined-walkthrough.mp4") {
  const fd = new FormData();
  fd.append("video", new File([blob], filename, { type: "video/mp4" }));

  const res = await fetch("/api/real-estate-video/save-combined", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server error: ${res.status}`);
  }

  return res.json();
}
