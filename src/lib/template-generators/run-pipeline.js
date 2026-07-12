import { generateFrameImages } from "./generate-images";
import { generateFrameVideos } from "./generate-videos";
import { mergeClips } from "./merge-clips";

// ─── Safety toggle ──────────────────────────────────────────────────────
// While the in-scene-presenter pipeline is being debugged, only render
// frame 1 of the storyboard — 5 fewer image+video calls per test run.
// FLIP THIS TO false BEFORE SHIPPING — with it on, the ad that reaches
// users will only ever be 1 frame long.
const TEST_MODE_LIMIT = true;

// Per-frame chain: Phase 3 (storyboard preview image, skipped if
// `frame.imageUrl` is already set) → Phase 4 (Veo video, animating THAT
// frame's own avatar_url, WITH native synchronized audio/lip-sync).
// `gender` is the same for every frame (one presenter) — a UI-provided
// flag passed down from runVideoAdPipeline, never classified or invented
// here.
async function processFrame(frame, { gender }) {
  const frameLabel = frame.frame ?? "?";
  try {
    let imageUrl = frame.imageUrl;
    if (!imageUrl) {
      const [rendered] = await generateFrameImages([frame]);
      imageUrl = rendered.imageUrl;
    }

    const [videoFrame] = await generateFrameVideos([frame], { gender });

    return {
      frame: frame.frame,
      videoUrl: videoFrame.videoUrl,
      imageUrl,
      narration: frame.narration,
    };
  } catch (err) {
    console.error(`[run-pipeline] Frame ${frameLabel} failed:`, err.message);
    throw new Error(`Frame ${frameLabel} failed: ${err.message}`);
  }
}

// Master orchestrator for the template video-ad pipeline:
//   Phase 3   (storyboard preview image, per frame) — generateFrameImages
//   Phase 4   (video + native audio, per frame)     — generateFrameVideos
//   Phase 5   (merge)                                — mergeClips
//
// Asset-anchored: every frame in `storyboard` already carries its own
// avatar_url/reference_image_url (assigned once, in generic.js's
// generateScript) — this orchestrator never re-derives or classifies
// anything about the presenter. `gender` is the one thing the backend
// still needs and can't read off a frame — it's a UI-provided flag from
// Add Assets, required here.
//
// TEST_MODE_LIMIT slices `storyboard` down to 1 frame while the pipeline
// is being tested/debugged.
export async function runVideoAdPipeline(storyboard, { userId, gender } = {}) {
  if (!gender) throw new Error("runVideoAdPipeline requires gender");

  const activeFrames = TEST_MODE_LIMIT ? storyboard.slice(0, 1) : storyboard;

  if (TEST_MODE_LIMIT) {
    console.warn(
      `[run-pipeline] TEST_MODE_LIMIT is ON — rendering 1 of ${storyboard.length} frames. Set TEST_MODE_LIMIT = false in run-pipeline.js before shipping.`
    );
  }

  // Frames run concurrently with each other; each frame's own phase 3→4
  // chain runs sequentially (Phase 4 needs Phase 3's preview image_url).
  const clips = await Promise.all(activeFrames.map((frame) => processFrame(frame, { gender })));

  const { videoUrl: finalVideoUrl } = await mergeClips(clips, { userId });

  return { clips, finalVideoUrl };
}
