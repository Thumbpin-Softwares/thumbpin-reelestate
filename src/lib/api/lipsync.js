// D-ID Lip-Sync API – Production Implementation
// Creates talking-head video from avatar image + audio
import fs from "fs/promises";
import path from "path";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const MAX_POLLS = 60; 
const POLL_INTERVAL_MS = 3000;

const GESTURE_MOTION_MAP = {
  subtle: 0.3,
  natural: 0.6,
  expressive: 1.0,
};

const EXPRESSION_MAP = {
  friendly: { expression: "happy", intensity: 0.5 },
  professional: { expression: "neutral", intensity: 0.3 },
  excited: { expression: "surprise", intensity: 0.8 },
  calm: { expression: "neutral", intensity: 0.2 },
  serious: { expression: "neutral", intensity: 0.1 },
};

/**
 * Generate lip-synced video using D-ID API and save locally
 * @param {string} imageUrl - URL of the avatar image
 * @param {string} audioUrl - URL of the TTS audio
 * @param {object} _unused - Previously supabaseAdmin
 * @param {string} videoId - Video ID for naming
 * @param {object} gestureConfig - Expression and gesture config
 * @returns {Promise<{success: boolean, video_url: string, duration_seconds: number}>}
 */
export async function generateLipSync(imageUrl, audioUrl, _unused, videoId, gestureConfig = {}) {
  const apiKey = process.env.DID_API_KEY;

  if (!apiKey) {
    throw new Error("DID_API_KEY is not configured");
  }

  // Ensure absolute URLs for D-ID if they are relative local paths
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const finalImageUrl = imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`;
  const finalAudioUrl = audioUrl.startsWith("http") ? audioUrl : `${baseUrl}${audioUrl}`;

  const motionFactor = GESTURE_MOTION_MAP[gestureConfig.gesture_intensity] ?? 0.6;
  const expressionConfig = EXPRESSION_MAP[gestureConfig.expression] || EXPRESSION_MAP.friendly;

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Lip-Sync] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      console.log(`[Lip-Sync] Creating talk for video ${videoId}...`);

      const didRequestBody = {
        source_url: finalImageUrl,
        script: {
          type: "audio",
          audio_url: finalAudioUrl,
        },
        config: {
          result_format: "mp4",
          stitch: true,
          motion_factor: motionFactor,
        },
      };

      if (expressionConfig.expression !== "neutral") {
        didRequestBody.config.driver_expressions = {
          expressions: [{
            start_frame: 0,
            expression: expressionConfig.expression,
            intensity: expressionConfig.intensity,
          }],
        };
      }

      const createResponse = await fetch("https://api.d-id.com/talks", {
        method: "POST",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(didRequestBody),
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.text().catch(() => "");
        throw new Error(`D-ID create talk failed (${createResponse.status}): ${errorBody}`);
      }

      const createResult = await createResponse.json();
      const talkId = createResult.id;

      console.log(`[Lip-Sync] Talk created: ${talkId}. Polling...`);

      // ── Polling ───────────────────────────────────────────────────────────
      for (let poll = 0; poll < MAX_POLLS; poll++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const pollResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
          headers: { Authorization: `Basic ${apiKey}` },
        });

        if (!pollResponse.ok) continue;
        const result = await pollResponse.json();

        if (result.status === "done") {
          const didVideoUrl = result.result_url;
          console.log(`[Lip-Sync] Downloading from D-ID...`);

          const videoResponse = await fetch(didVideoUrl);
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

          // Save locally
          const uploadDir = path.join(process.cwd(), "public", "uploads", "videos");
          await fs.mkdir(uploadDir, { recursive: true });
          
          const fileName = `${videoId}.mp4`;
          const filePath = path.join(uploadDir, fileName);
          await fs.writeFile(filePath, videoBuffer);

          const publicVideoUrl = `/uploads/videos/${fileName}`;
          console.log(`[Lip-Sync] Video saved locally: ${publicVideoUrl}`);

          return {
            success: true,
            video_url: publicVideoUrl,
            duration_seconds: result.duration || 0,
          };
        }

        if (result.status === "error" || result.status === "rejected") {
          throw new Error(`D-ID failed: ${result.error?.description || "Unknown"}`);
        }
      }

      throw new Error("D-ID timed out");
    } catch (error) {
      lastError = error;
      console.error(`[Lip-Sync] Attempt ${attempt + 1} failed:`, error.message);
      if (error.message.includes("invalid") || error.message.includes("exhausted")) break;
    }
  }

  throw lastError;
}
