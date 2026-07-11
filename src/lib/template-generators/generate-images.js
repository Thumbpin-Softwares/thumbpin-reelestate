import { fal } from "@fal-ai/client";
import { withTimeout } from "./with-timeout";

// Turns a verified 6-frame storyboard (from generic.js's generateScript)
// into 6 static vertical images — the next stage of the template pipeline,
// upstream of Veo image-to-video. All 6 frames run concurrently so this
// doesn't scale linearly with frame count and risk a frontend timeout.
//
// Asset-anchored: each frame already carries its OWN reference_image_url
// (one of the user's uploaded property photos, picked by the storyboard
// step) and avatar_url (the user's chosen presenter) — generic.js's
// parseStoryboard is what guarantees both are present and valid, never
// this function. This function does not fall back to a generic/global
// asset list; a frame missing either is a bug upstream, not something to
// paper over with a default image.
const IMAGE_MODEL = "fal-ai/nano-banana-2";
const TIMEOUT_MS = 120_000; // fal's queue poll has been observed to wedge — never wait forever

export async function generateFrameImages(storyboard) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  fal.config({ credentials: process.env.FAL_KEY });

  const jobs = storyboard.map(async (frame, index) => {
    const label = `frame ${frame.frame ?? index}`;
    if (!frame.avatar_url || !frame.reference_image_url) {
      throw new Error(
        `Frame ${frame.frame ?? index} is missing ${!frame.avatar_url ? "avatar_url" : "reference_image_url"} — refusing to generate without a real asset reference`
      );
    }
    // Avatar first so it's weighted as the primary subject, then this
    // frame's specific property photo, as architectural/background
    // reference.
    const referenceImages = [frame.avatar_url, frame.reference_image_url];

    console.log(`[generate-images] ${label} starting (avatar + reference_image_index-resolved property photo)...`);
    try {
      const result = await withTimeout(
        fal.subscribe(IMAGE_MODEL, {
          input: {
            prompt: frame.image_prompt,
            aspect_ratio: "9:16",
            resolution: "1K",
            enable_web_search: false,
            image_urls: referenceImages,
          },
          logs: false,
        }),
        TIMEOUT_MS,
        `${IMAGE_MODEL} (${label})`
      );

      const imageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url;
      if (!imageUrl) throw new Error(`${IMAGE_MODEL} returned no image`);

      console.log(`[generate-images] ${label} done: ${imageUrl}`);
      return {
        frame: frame.frame,
        imageUrl,
        video_action: frame.video_action,
        narration: frame.narration,
        avatar_url: frame.avatar_url,
        reference_image_url: frame.reference_image_url,
      };
    } catch (err) {
      console.error(`[generate-images] ${label} failed:`, err.message);
      throw new Error(`Frame ${frame.frame ?? index} image generation failed: ${err.message}`);
    }
  });

  return Promise.all(jobs);
}
