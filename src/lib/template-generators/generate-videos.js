import { fal } from "@fal-ai/client";
import { SECONDS_PER_FRAME } from "./generic";
import { withTimeout } from "./with-timeout";

// Turns the storyboard's frames into animated, TALKING 9:16 clips — Gemini
// Omni Flash reference-to-video, one call per frame, all running
// concurrently for the same reason generateFrameImages does (avoid a
// linear N-frame timeout).
//
// Asset-anchored: the reference image for every frame is THAT frame's own
// avatar_url — the user's own uploaded presenter avatar, carried on the
// frame object since generic.js's generateScript assigned it — never a
// generated image, so the same real person appears throughout and the
// model is never asked to invent a face. `gender` is a UI-provided flag
// (the user picks it when choosing their avatar in Add Assets) — this
// module never guesses or classifies it.
//
// This model's input is just prompt / images / aspect_ratio / duration —
// no resolution or generate_audio knob to set. The dialogue is quoted
// straight into the prompt and the model animates it from tonality itself,
// same as the frame's own storyboard image drives the visuals.
//
// COST NOTE: keep duration pinned to exactly SECONDS_PER_FRAME seconds —
// leaving it unset lets the endpoint fall back to its own default, silently
// multiplying cost per frame. Verify against fal's current pricing page for
// this exact model before trusting any cost estimate blindly.
const VIDEO_MODEL = "google/gemini-omni-flash/reference-to-video";
const TIMEOUT_MS = 300_000; // video generation runs longer than images — fal's queue poll has been observed to wedge, never wait forever

function buildPrompt(frame, gender) {
  return `${frame.video_action}. Sample Dialogue: ${gender} Presenter: "${frame.narration}"`;
}

export async function generateFrameVideos(frames, { gender }) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  if (!gender) throw new Error("generateFrameVideos requires gender");
  fal.config({ credentials: process.env.FAL_KEY });

  const jobs = frames.map(async (frame, index) => {
    const label = `frame ${frame.frame ?? index}`;
    if (!frame.avatar_url) {
      throw new Error(`Frame ${frame.frame ?? index} is missing avatar_url — refusing to animate without a real presenter reference`);
    }

    console.log(`[generate-videos] ${label} starting (${gender} presenter)...`);
    try {
      const result = await withTimeout(
        fal.subscribe(VIDEO_MODEL, {
          input: {
            images: [frame.avatar_url],
            prompt: buildPrompt(frame, gender),
            aspect_ratio: "9:16",
            duration: `${SECONDS_PER_FRAME}s`,
          },
          logs: false,
        }),
        TIMEOUT_MS,
        `${VIDEO_MODEL} (${label})`
      );

      const videoUrl = result?.data?.video?.url ?? result?.video?.url;
      if (!videoUrl) throw new Error(`${VIDEO_MODEL} returned no video`);

      console.log(`[generate-videos] ${label} done: ${videoUrl}`);
      return {
        frame: frame.frame,
        videoUrl,
        imageUrl: frame.avatar_url,
        narration: frame.narration,
      };
    } catch (err) {
      console.error(`[generate-videos] ${label} failed:`, err.message, err.body ? JSON.stringify(err.body) : "");
      throw new Error(`Frame ${frame.frame ?? index} video generation failed: ${err.message}`);
    }
  });

  return Promise.all(jobs);
}
