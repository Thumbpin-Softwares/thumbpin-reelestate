import { fal } from "@fal-ai/client";

// Phase 4.2: merges a silent Veo clip with its narration audio into a
// talking clip — the in-scene presenter actually lip-syncs the line instead
// of the video just having narration laid under it. Runs once per frame,
// after Phase 4 (video) and Phase 4.1 (audio) have both resolved for that
// frame — this is the step that turns "presenter standing there" into
// "presenter talking."
const LIPSYNC_MODEL = "fal-ai/sync-lipsync/v2";

export async function generateLipSyncVideo({ videoUrl, audioUrl }) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  if (!videoUrl) throw new Error("generateLipSyncVideo requires a videoUrl");
  if (!audioUrl) throw new Error("generateLipSyncVideo requires an audioUrl");
  fal.config({ credentials: process.env.FAL_KEY });

  const result = await fal.subscribe(LIPSYNC_MODEL, {
    input: { video_url: videoUrl, audio_url: audioUrl },
    logs: false,
  });

  const syncedVideoUrl = result?.data?.video?.url ?? result?.video?.url;
  if (!syncedVideoUrl) throw new Error(`${LIPSYNC_MODEL} returned no video URL`);
  return syncedVideoUrl;
}
