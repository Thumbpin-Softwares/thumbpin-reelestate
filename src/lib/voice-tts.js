import { fal } from "@fal-ai/client";
import { ELEVENLABS_VOICE_SETTINGS } from "@/lib/elevenlabs-config";
import { SARVAM_MODEL, SARVAM_LANGUAGE_CODES } from "@/lib/sarvam-config";

const SARVAM_PREFIX = "sarvam:";

export function isSarvamVoice(voiceId) {
  return typeof voiceId === "string" && voiceId.startsWith(SARVAM_PREFIX);
}

async function synthesizeElevenLabs(text, voiceId) {
  const vs =
    ELEVENLABS_VOICE_SETTINGS[voiceId] ??
    ELEVENLABS_VOICE_SETTINGS["dVTC43Yewy5fAIcmsISI"];
  const result = await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
    input: {
      text,
      voice: voiceId,
      stability: vs.stability,
      similarity_boost: vs.similarity_boost,
      style: vs.style,
      speed: vs.speed,
    },
    logs: false,
  });
  const audioUrl = result?.data?.audio_url || result?.data?.audio?.url;
  if (!audioUrl) throw new Error("ElevenLabs returned no audio URL");
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Failed to download ElevenLabs audio: ${res.status}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: "audio/mpeg",
    ext: "mp3",
  };
}

async function synthesizeSarvam(text, voiceId, language) {
  if (!process.env.SARVAM_API_KEY) throw new Error("SARVAM_API_KEY not configured");
  const speaker = voiceId.slice(SARVAM_PREFIX.length);
  const targetLanguageCode = SARVAM_LANGUAGE_CODES[language] || "en-IN";

  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": process.env.SARVAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      speaker,
      target_language_code: targetLanguageCode,
      model: SARVAM_MODEL,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sarvam TTS failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const base64Audio = data?.audios?.[0];
  if (!base64Audio) throw new Error("Sarvam returned no audio");
  return {
    buffer: Buffer.from(base64Audio, "base64"),
    contentType: "audio/wav",
    ext: "wav",
  };
}

/**
 * Synthesizes `text` in `voiceId`'s voice, routing to Sarvam or ElevenLabs
 * based on the voiceId's provider prefix — callers pick a voice from the
 * combined catalog without needing to know which provider it belongs to.
 */
export async function synthesizeVoice({ text, voiceId, language }) {
  if (isSarvamVoice(voiceId)) {
    return synthesizeSarvam(text, voiceId, language);
  }
  return synthesizeElevenLabs(text, voiceId);
}
