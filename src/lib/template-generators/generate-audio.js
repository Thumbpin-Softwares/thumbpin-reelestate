import { fal } from "@fal-ai/client";
import { ELEVENLABS_VOICES } from "@/lib/elevenlabs-config";

// Phase 4.1: narration text → voiceover audio, for a single frame. Uses
// ElevenLabs' Turbo v2.5 (lower latency/cost tier than the
// multilingual-v2 model lib/voice-tts.js uses for other pipelines) since
// this now runs once per frame (6x per ad) rather than once for a whole
// script — the cheaper tier matters more at this call volume.
const AUDIO_MODEL = "elevenlabs/tts/turbo-v2.5";

// Anvi — the same default voice already mapped as the fallback across the
// other pipelines in this codebase (see ELEVENLABS_VOICE_SETTINGS default
// key in lib/elevenlabs-config.js), used here when no template-specific
// voice has been picked.
const DEFAULT_VOICE_ID = ELEVENLABS_VOICES.find((v) => v.label.startsWith("Anvi"))?.id
  ?? "dVTC43Yewy5fAIcmsISI";

export async function generateNarrationAudio(text, { voiceId = DEFAULT_VOICE_ID } = {}) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  if (!text?.trim()) throw new Error("No narration text to synthesize");
  fal.config({ credentials: process.env.FAL_KEY });

  const result = await fal.subscribe(AUDIO_MODEL, {
    input: { text, voice: voiceId },
    logs: false,
  });

  const audioUrl = result?.data?.audio?.url ?? result?.audio?.url ?? result?.data?.audio_url;
  if (!audioUrl) throw new Error(`${AUDIO_MODEL} returned no audio URL`);
  return audioUrl;
}
