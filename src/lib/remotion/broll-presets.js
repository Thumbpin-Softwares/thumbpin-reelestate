// Editable style-preset bundle for the News Anchor B-roll pipeline.
// Each preset fully describes the "look" of the montage — how long each
// image clip holds, which transition stitches clips together, the color
// grade, whether letterbox bars are shown, film grain, and a default
// background music track. Add a new preset here to add a new style —
// nothing else in the pipeline needs to change.

// Ken Burns motions cycle through this list per clip (index % length) so no
// two consecutive shots move the same way.
export const KEN_BURNS_MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-up"];

// CSS filter() strings used to approximate a color grade LUT. A true 3D LUT
// (.cube) would need a canvas/WebGL pass — this is the fast, good-enough v1.
export const LUTS = {
  none:      "",
  warm:      "contrast(1.08) saturate(1.25) sepia(0.12) brightness(1.02)",
  cool:      "contrast(1.1) saturate(1.1) hue-rotate(-8deg) brightness(0.98)",
  cinematic: "contrast(1.15) saturate(0.9) brightness(0.95) sepia(0.08)",
  bw:        "grayscale(1) contrast(1.2)",
};

export const BROLL_PRESETS = [
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Slow Ken Burns, soft crossfades, letterboxed, warm grade.",
    clipDurationSeconds: 2.6,
    transition: { type: "fade", durationSeconds: 0.45 },
    lut: "cinematic",
    letterbox: true,
    grain: true,
    musicUrl: "",
  },
  {
    id: "snappy",
    label: "Snappy",
    description: "Faster cuts, slide transitions, punchy cool grade.",
    clipDurationSeconds: 1.5,
    transition: { type: "slide", durationSeconds: 0.25 },
    lut: "cool",
    letterbox: false,
    grain: false,
    musicUrl: "",
  },
  {
    id: "warm-tour",
    label: "Warm Tour",
    description: "Gentle pace, wipe transitions, warm inviting grade.",
    clipDurationSeconds: 2.2,
    transition: { type: "wipe", durationSeconds: 0.4 },
    lut: "warm",
    letterbox: true,
    grain: false,
    musicUrl: "",
  },
  {
    id: "mono",
    label: "Mono",
    description: "Black & white editorial look with hard fades.",
    clipDurationSeconds: 1.8,
    transition: { type: "fade", durationSeconds: 0.3 },
    lut: "bw",
    letterbox: false,
    grain: true,
    musicUrl: "",
  },
];

export function getPresetById(id) {
  return BROLL_PRESETS.find((p) => p.id === id) || BROLL_PRESETS[0];
}
