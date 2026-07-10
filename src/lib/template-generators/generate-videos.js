import { fal } from "@fal-ai/client";
import { SECONDS_PER_FRAME } from "./generic";

// Turns Phase 3's rendered image frames into animated 9:16 clips — Veo
// image-to-video, one call per frame, all running concurrently for the
// same reason generateFrameImages does (avoid a linear N-frame timeout).
//
// COST NOTE: this must stay the FAST tier, at 720p, for exactly
// SECONDS_PER_FRAME seconds. Do not remove the explicit `resolution` /
// `duration` below — leaving either unset lets the endpoint fall back to
// its own default, which for Veo has historically meant a longer clip
// and/or a higher (1080p/4K-tier) resolution than intended, silently
// multiplying cost per frame. A single 36s run should cost roughly
// 6 frames x 6s x fast-tier-720p rate — verify against fal's current
// pricing page for this exact model before trusting the estimate blindly.
const VIDEO_MODEL = "fal-ai/veo3.1/fast/image-to-video";
const RESOLUTION = "720p";

export async function generateFrameVideos(imageFrames) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  fal.config({ credentials: process.env.FAL_KEY });

  const jobs = imageFrames.map(async (frame, index) => {
    try {
      const result = await fal.subscribe(VIDEO_MODEL, {
        input: {
          image_url: frame.imageUrl,
          prompt: frame.video_action,
          aspect_ratio: "9:16",
          resolution: RESOLUTION,
          duration: `${SECONDS_PER_FRAME}s`,
        },
        logs: false,
      });

      const videoUrl = result?.data?.video?.url ?? result?.video?.url;
      if (!videoUrl) throw new Error(`${VIDEO_MODEL} returned no video`);

      return {
        frame: frame.frame,
        videoUrl,
        imageUrl: frame.imageUrl,
        narration: frame.narration,
      };
    } catch (err) {
      console.error(`[generate-videos] Frame ${frame.frame ?? index} failed:`, err.message);
      throw new Error(`Frame ${frame.frame ?? index} video generation failed: ${err.message}`);
    }
  });

  return Promise.all(jobs);
}
