export const ELEVENLABS_VOICES = [
  { id: "dVTC43Yewy5fAIcmsISI", label: "Anvi (Female)" },
  { id: "K2Byg54sHB1oHegvENtI", label: "Kanika (Female)" },
  { id: "7b9mYhmnp0y2qSH1FnBL", label: "Bunty (Male)" },
  { id: "JS6C6yu2x9Byh4i1a8lX", label: "Meher (Female)" },
  { id: "DdD5pVl1QDeeI6MMtYbk", label: "Abhay (Male)" },
];

export const ELEVENLABS_VOICE_SETTINGS = {
  // per-voice settings — keyed by ElevenLabs voice ID
  // NOTE: only `style` (emotional expressiveness) was bumped up here to fix flat
  // delivery — stability/similarity_boost/speed are intentionally untouched, they
  // were already tuned and validated for natural pacing/pronunciation.
  "dVTC43Yewy5fAIcmsISI": { stability: 0.22, similarity_boost: 0.10, style: 0.30, speed: 1.12 }, // Anvi (Female)
  "K2Byg54sHB1oHegvENtI": { stability: 0.28, similarity_boost: 0.20, style: 0.30, speed: 1.20 }, // Kanika (Female)
  "7b9mYhmnp0y2qSH1FnBL": { stability: 0.24, similarity_boost: 0.08, style: 0.30, speed: 1.22 }, // Bunty (Male)
  "JS6C6yu2x9Byh4i1a8lX": { stability: 0.44, similarity_boost: 0.40, style: 0.30, speed: 1.50 }, // Meher (Female)
  "DdD5pVl1QDeeI6MMtYbk": { stability: 0.22, similarity_boost: 0.10, style: 0.30, speed: 1.12 }, // Abhay (Male)
};

export const ELEVENLABS_MODEL = "eleven_multilingual_v2";
