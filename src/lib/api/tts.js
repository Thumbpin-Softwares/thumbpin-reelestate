// ElevenLabs TTS API – Production Implementation
// Generates speech audio from text using Indian-English voices
import fs from "fs/promises";
import path from "path";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Generate TTS audio using ElevenLabs API and save to local storage
 * @param {string} text - The script text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {object} _unused - Previously supabaseAdmin
 * @param {string} videoId - Video ID for naming the audio file
 * @returns {Promise<{success: boolean, audio_url: string, duration_seconds: number}>}
 */
export async function generateTTS(text, voiceId, _unused, videoId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[TTS] Retry attempt ${attempt}/${MAX_RETRIES}...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      console.log(`[TTS] Generating audio for video ${videoId} (${text.length} chars)...`);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`ElevenLabs API error ${response.status}: ${errorBody}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      if (audioBuffer.length === 0) {
        throw new Error("ElevenLabs returned empty audio");
      }

      // ── Save to Local Storage ─────────────────────────────────────────────
      const uploadDir = path.join(process.cwd(), "public", "uploads", "audio");
      await fs.mkdir(uploadDir, { recursive: true });
      
      const fileName = `${videoId}.mp3`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, audioBuffer);

      const audioUrl = `/uploads/audio/${fileName}`;
      console.log(`[TTS] Audio saved locally: ${audioUrl}`);

      const wordCount = text.split(/\s+/).length;
      const durationSeconds = Math.ceil(wordCount / 2.5);

      return {
        success: true,
        audio_url: audioUrl,
        duration_seconds: durationSeconds,
      };
    } catch (error) {
      lastError = error;
      console.error(`[TTS] Attempt ${attempt + 1} failed:`, error.message);
      if (error.message.includes("invalid") || error.message.includes("quota")) break;
    }
  }

  throw lastError;
}
