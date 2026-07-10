import { fal } from "@fal-ai/client";

// Turns a verified 6-frame storyboard (from generic.js's generateScript)
// into 6 static vertical images — the next stage of the template pipeline,
// upstream of Veo image-to-video. All 6 frames run concurrently so this
// doesn't scale linearly with frame count and risk a frontend timeout.
const IMAGE_MODEL = "fal-ai/nano-banana-2";

export async function generateFrameImages(storyboard) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  fal.config({ credentials: process.env.FAL_KEY });

  const jobs = storyboard.map(async (frame, index) => {
    try {
      const result = await fal.subscribe(IMAGE_MODEL, {
        input: {
          prompt: frame.image_prompt,
          aspect_ratio: "9:16",
          resolution: "1K",
          enable_web_search: false,
        },
        logs: false,
      });

      const imageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url;
      if (!imageUrl) throw new Error(`${IMAGE_MODEL} returned no image`);

      return {
        frame: frame.frame,
        imageUrl,
        video_action: frame.video_action,
        narration: frame.narration,
      };
    } catch (err) {
      console.error(`[generate-images] Frame ${frame.frame ?? index} failed:`, err.message);
      throw new Error(`Frame ${frame.frame ?? index} image generation failed: ${err.message}`);
    }
  });

  return Promise.all(jobs);
}
