import { fal } from "@fal-ai/client";
import { SECONDS_PER_FRAME } from "./generic";
import { withTimeout } from "./with-timeout";

// Turns the storyboard's frames into animated, TALKING 9:16 clips — Veo 3.1
// image-to-video with native audio generation, one call per frame, all
// running concurrently for the same reason generateFrameImages does (avoid
// a linear N-frame timeout).
//
// Asset-anchored: the starting image for every frame is THAT frame's own
// avatar_url — the user's own uploaded presenter avatar, carried on the
// frame object since generic.js's generateScript assigned it — never a
// generated image, so the same real person appears throughout and Veo is
// never asked to invent a face. `gender` is a UI-provided flag (the user
// picks it when choosing their avatar in Add Assets) — this module never
// guesses or classifies it.
//
// Veo 3.1 supports native synchronized dialogue/lip-sync in a single pass
// when `generate_audio: true` and the prompt explicitly quotes the line to
// be spoken — no separate TTS + lip-sync call needed. This replaced a prior
// 3-call-per-frame pipeline (Veo silent video → ElevenLabs TTS →
// sync-lipsync merge) with this one call.
//
// COST NOTE: this must stay the FAST tier, at 720p, for exactly
// SECONDS_PER_FRAME seconds. Do not remove the explicit `resolution` /
// `duration` below — leaving either unset lets the endpoint fall back to
// its own default, which for Veo has historically meant a longer clip
// and/or a higher (1080p/4K-tier) resolution than intended, silently
// multiplying cost per frame. Verify against fal's current pricing page for
// this exact model before trusting any cost estimate blindly.
//
// NOTE on reference_image_url: Veo 3.1 image-to-video's documented input is
// a single seed image, not two — so the property photo the storyboard
// pinned this frame to (frame.reference_image_url) is NOT passed as a
// second binary image here (an unverified second-image param is exactly
// the kind of guess that previously caused 400s). Its "background/context"
// role is carried instead through frame.video_action/image_prompt text,
// which generic.js already grounded in that specific property photo.
const VIDEO_MODEL = "fal-ai/veo3.1/fast/image-to-video";
const RESOLUTION = "720p";
const TIMEOUT_MS = 300_000; // video generation runs longer than images — fal's queue poll has been observed to wedge, never wait forever

function buildPrompt(frame, gender) {
  // Veo 3.1 needs the dialogue explicitly quoted to trigger native lip-sync.
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
            image_url: frame.avatar_url,
            prompt: buildPrompt(frame, gender),
            aspect_ratio: "9:16",
            resolution: RESOLUTION,
            duration: `${SECONDS_PER_FRAME}s`,
            generate_audio: true,
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
      console.error(`[generate-videos] ${label} failed:`, err.message);
      throw new Error(`Frame ${frame.frame ?? index} video generation failed: ${err.message}`);
    }
  });

  return Promise.all(jobs);
}
