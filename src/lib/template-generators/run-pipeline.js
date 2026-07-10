import { generateFrameImages } from "./generate-images";
import { generateFrameVideos } from "./generate-videos";
import { generateNarrationAudio } from "./generate-audio";
import { generateLipSyncVideo } from "./generate-lipsync";
import { mergeClips } from "./merge-clips";

// ─── Safety toggle ──────────────────────────────────────────────────────
// While the in-scene-presenter + lip-sync pipeline is being debugged, only
// render frame 1 of the storyboard — 5 fewer image+video+TTS+lipsync calls
// per test run. FLIP THIS TO false BEFORE SHIPPING — with it on, the ad
// that reaches users will only ever be 1 frame long.
const TEST_MODE_LIMIT = true;

// Per-frame chain: Phase 3 (image) → Phase 4 (silent video) → Phase 4.1
// (narration TTS) → Phase 4.2 (lip-sync merge). If `frame.imageUrl` is
// already set (the current UI flow pre-renders images in StepFinalize
// before the user hits Continue), Phase 3 is skipped rather than re-billed.
async function processFrame(frame, { voiceId } = {}) {
  const frameLabel = frame.frame ?? "?";
  try {
    let imageUrl = frame.imageUrl;
    if (!imageUrl) {
      const [rendered] = await generateFrameImages([frame]);
      imageUrl = rendered.imageUrl;
    }

    const [videoFrame] = await generateFrameVideos([{ ...frame, imageUrl }]);
    const audioUrl = await generateNarrationAudio(frame.narration, { voiceId });
    const syncedVideoUrl = await generateLipSyncVideo({ videoUrl: videoFrame.videoUrl, audioUrl });

    return {
      frame: frame.frame,
      videoUrl: syncedVideoUrl,
      imageUrl,
      narration: frame.narration,
    };
  } catch (err) {
    console.error(`[run-pipeline] Frame ${frameLabel} failed:`, err.message);
    throw new Error(`Frame ${frameLabel} failed: ${err.message}`);
  }
}

// Master 5-phase orchestrator for the template video-ad pipeline:
//   Phase 3   (image)          — generateFrameImages
//   Phase 4   (silent video)   — generateFrameVideos
//   Phase 4.1 (narration TTS)  — generateNarrationAudio
//   Phase 4.2 (lip-sync)       — generateLipSyncVideo
//   Phase 5   (merge)          — mergeClips
//
// `storyboard` is the array of frame objects at whatever stage they enter
// at (raw Phase 1 text, or already carrying an `imageUrl` from an earlier
// Phase 3 call) — TEST_MODE_LIMIT slices THIS array, so with it on, only
// storyboard[0] goes through Phase 3-5 at all.
export async function runVideoAdPipeline(storyboard, { userId, voiceId } = {}) {
  const activeFrames = TEST_MODE_LIMIT ? storyboard.slice(0, 1) : storyboard;

  if (TEST_MODE_LIMIT) {
    console.warn(
      `[run-pipeline] TEST_MODE_LIMIT is ON — rendering 1 of ${storyboard.length} frames. Set TEST_MODE_LIMIT = false in run-pipeline.js before shipping.`
    );
  }

  // Frames run concurrently with each other; each frame's own phase 3→4.2
  // chain runs sequentially (each phase needs the previous phase's output).
  const clips = await Promise.all(activeFrames.map((frame) => processFrame(frame, { voiceId })));
  const { videoUrl: finalVideoUrl } = await mergeClips(clips, { userId });

  return { clips, finalVideoUrl };
}
