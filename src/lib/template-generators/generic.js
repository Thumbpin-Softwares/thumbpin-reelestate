import { fal } from "@fal-ai/client";

// Default script generator — used by any property template that hasn't
// been given its own generation module yet. Writes as a veteran property ad
// director: word choice, pacing, and framing all shift with the project's
// price tier and classification, not just a single flat "tone" field.
//
// Model: fal-ai/any-llm, routed to Google's cheapest model on that endpoint
// (Gemini Flash 1.5 8B) — this is a short, well-constrained prompt, so the
// cheap tier is plenty; see fal-ai/any-llm's model enum for the full list.
const MODEL = "google/gemini-flash-1.5-8b";

async function callAnyLLM(prompt, { temperature = 0.7, max_tokens = 600 } = {}) {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  fal.config({ credentials: process.env.FAL_KEY });

  const result = await fal.subscribe("fal-ai/any-llm", {
    input: { model: MODEL, prompt, temperature, max_tokens },
    logs: false,
  });
  if (result?.data?.error) throw new Error(result.data.error);
  const output = (result?.data?.output ?? result?.output ?? "").toString().trim();
  if (!output) throw new Error(`${MODEL} returned an empty script`);
  return output;
}

// Roman-transliterated for hindi/hinglish, same approach used elsewhere in
// this codebase (e.g. veo-long-ad's script generator) — small models are far
// more reliable writing Roman-script code-switched copy than native script.
const LANGUAGE_INSTRUCTION = {
  english: "English (Indian real-estate ad-director style)",
  hindi: "Hindi (Roman transliteration, conversational urban Hindi)",
  hinglish: "Hinglish (natural Hindi + English mix, Roman script)",
};

// Price tier shapes word choice and pacing far more than any single "tone"
// dropdown could — an affordable-housing script and an ultra-luxury script
// shouldn't just differ in adjectives, they should sound like different
// people wrote them.
const TONE_BY_PROJECT_TYPE = {
  affordable: "value-driven and honest — plain, practical word choice, emphasize affordability and smart value without ever sounding cheap or desperate. Direct, upbeat pacing.",
  luxury: "polished and aspirational — refined, confident word choice, exclusivity without being over the top. Smooth, assured pacing.",
  "ultra-luxury": "opulent and exclusive — rare-privilege framing, understated grandeur, precise and deliberate word choice, no hard-selling. Slower, weightier pacing; every line should feel earned.",
};

// Classification changes who's being sold to and what they care about, not
// just the vocabulary — an investor evaluating a shop is not the same
// audience as a family picturing themselves living somewhere.
const TONE_BY_CLASSIFICATION = {
  commercial: "business-focused — speak to investors/business owners; frame around footfall, visibility, ROI and brand fit.",
  residential: "warm and lifestyle-focused — speak to a family or homeowner; frame around the living experience, comfort, and belonging.",
  plotted: "land/investment-focused — frame around future potential, freedom to build, ownership, and long-term appreciation.",
};

function classificationDetails(values) {
  const lines = [];
  if (values.propertyClassification === "commercial") {
    lines.push(`- Shop type: ${values.shopType || "n/a"}`);
    lines.push(`- Shop built-up area: ${values.shopBuiltUpArea || "n/a"}`);
    if (values.footfall) lines.push(`- Footfall: ${values.footfall}`);
    if (values.brandRelationships) lines.push(`- Brand relationships: ${values.brandRelationships}`);
    if (values.revenuePotential) lines.push(`- Revenue potential: ${values.revenuePotential}`);
  } else if (values.propertyClassification === "residential") {
    lines.push(`- Carpet area: ${values.carpetArea || "n/a"}`);
    if (values.amenities) lines.push(`- Amenities: ${values.amenities}`);
    if (values.features) lines.push(`- Features: ${values.features}`);
  } else if (values.propertyClassification === "plotted") {
    lines.push(`- Carpet area: ${values.carpetArea || "n/a"}`);
    lines.push(`- Gated community: ${values.gatedCommunity ? "Yes" : "No"}`);
    if (values.waterSupplyAreaType) lines.push(`- Water supply & area type: ${values.waterSupplyAreaType}`);
    if (values.nearbySettlements) lines.push(`- Nearby settlements: ${values.nearbySettlements}`);
    if (values.amenities) lines.push(`- Amenities: ${values.amenities}`);
    if (values.features) lines.push(`- Features: ${values.features}`);
  }
  return lines;
}

// Exported so generate-videos.js can request exactly this many seconds of
// video per frame from Veo instead of trusting its default duration — the
// two must stay in lockstep with what the script prompt promises per frame.
export const FRAME_COUNT = 6;
export const SECONDS_PER_FRAME = 6;

function buildPrompt(values, template, images) {
  const langInstruction = LANGUAGE_INSTRUCTION[values.language] || LANGUAGE_INSTRUCTION.english;
  const tierTone = TONE_BY_PROJECT_TYPE[values.projectType] || TONE_BY_PROJECT_TYPE.luxury;
  const classificationTone = TONE_BY_CLASSIFICATION[values.propertyClassification] || "";

  const detailLines = [
    `- Project name: ${values.projectName || "n/a"}`,
    `- Property classification: ${values.propertyClassification || "n/a"}`,
    `- Project type: ${values.projectType || "n/a"}`,
    `- Project area: ${values.projectArea || "n/a"}`,
    `- Location: ${values.location || "n/a"}`,
    ...(values.landmarks ? [`- Landmarks: ${values.landmarks}`] : []),
    ...(values.connectivity ? [`- Connectivity: ${values.connectivity}`] : []),
    ...classificationDetails(values),
  ];

  // Reference photos of the actual property — uploaded to R2 in Step 0 —
  // ground the generated image_prompts in what this property really looks
  // like, instead of the model inventing a generic building.
  const hasImages = Array.isArray(images) && images.length > 0;
  const visualAssetsBlock = hasImages
    ? images.map((url, i) => `${i + 1}. ${url}`).join("\n")
    : "None provided.";

  // Variable/user-controlled content is wrapped in XML-style tags and kept
  // separate from the instructions around it — this keeps the model from
  // confusing "content to reason about" with "instructions to follow" (the
  // confusion that previously caused it to paste prompt text into a
  // video_action field instead of writing one).
  return `You are a veteran property ad film director, planning a ${FRAME_COUNT * SECONDS_PER_FRAME}-second, 9:16 VERTICAL MOBILE VIDEO AD (Reels/Shorts format) shot-by-shot. You are storyboarding "${template.title}" as a sequence of exactly ${FRAME_COUNT} frames, each ${SECONDS_PER_FRAME} seconds long, that together tell one continuous vertical ad.

<property_details>
${detailLines.join("\n")}
</property_details>

<visual_reference_assets>
${visualAssetsBlock}
</visual_reference_assets>

<client_direction>
${values.tonality || "n/a"}
</client_direction>

HOW THIS AD MUST FEEL — combine both of these, they are not optional:
1. Price tier (${values.projectType || "n/a"}): ${tierTone}
2. Listing type (${values.propertyClassification || "n/a"}): ${classificationTone}

NARRATION LANGUAGE: ${langInstruction}
${hasImages ? `
VISUAL GROUNDING — MANDATORY: Analyze the image URLs inside <visual_reference_assets> above. Your generated image_prompt for every single frame MUST strictly preserve the architectural style, design aesthetics, material palettes (e.g. marble, wood, concrete), and colors seen in these images. Do not invent a completely different looking building — every frame must look like the same property shown in the reference photos.
` : ""}
FORMAT — 9:16 VERTICAL, NOT OPTIONAL: Every frame is composed for a tall vertical phone screen, not widescreen. Frame every image_prompt as a vertical composition (portrait orientation, tall foreground subject filling the frame, headroom and footroom considered).
Completely avoid horizontal-framing language — never write "wide sweeping pan", "wide landscape shot", "wide establishing shot", or anything implying a horizontal cinematic frame.
Instead, video_action must use vertical-native camera movements: slow vertical tilts (floor to ceiling / ceiling to floor), push-ins, upward drone ascents tracking the building's height, and tracking shots that follow vertical lines and luxury textures (columns, facades, staircases) rather than sweeping sideways.

IN-SCENE PRESENTER — MANDATORY, NOT OPTIONAL: This ad uses an in-scene AI presenter who is visible, moving, and lip-syncing the narration in every single frame — this is not a b-roll/architecture-only ad. Every frame's image_prompt MUST explicitly include this exact framing: "A cinematic medium-close-up of the presenter facing directly at the camera, standing in ${values.location || "the property"}." Build the rest of the shot's description (lighting, mood, background detail, wardrobe) around that mandatory sentence — never drop it, never replace it with a wide or profile shot, and never generate a frame where the presenter's face is small, turned away, or absent. The lip-sync step downstream depends on a large, forward-facing, unobstructed face in every frame — a distant, angled, or missing face will cause it to fail.

For EACH of the ${FRAME_COUNT} frames, decide:
1. image_prompt — a detailed vertical (9:16) visual prompt for an image-generation model: open with the mandatory presenter framing sentence above, then describe the rest of the shot (setting, lighting, mood, background) with enough detail to generate one striking still frame of this property ad${hasImages ? ", grounded in <visual_reference_assets> above" : ""}. Compose it for a tall vertical frame, not a wide one.
2. video_action — a short vertical-native motion/camera-movement prompt for an image-to-video model (Veo): tilts, push-ins, upward ascents, or vertical tracking shots only — no horizontal pans or wide sweeping moves. Describe ONLY the camera/subject movement in your own words — never copy, quote, or reference any instructions, tags, or text from this prompt itself.
3. narration — the spoken voiceover line for this frame only, in NARRATION LANGUAGE, natural and speakable in about ${SECONDS_PER_FRAME} seconds (roughly 12–18 words). Across all ${FRAME_COUNT} frames the narration must read as one continuous, escalating script. Frame 1's hook is the most important line in the whole ad — vertical short-form video lives or dies in the first second of a scroll, so it must be punchy, hyper-engaging, and immediately scroll-stopping (a bold claim, a striking question, or an arresting statement — not a slow warm-up). Build highlights through the middle frames, and close with a strong call-to-action in the final frame.

Reflect the price tier and listing type tone above in both the visual direction (image_prompt/video_action) and the narration word choice — not just the subject matter.

OUTPUT FORMAT — STRICT:
Return ONLY a raw JSON array of exactly ${FRAME_COUNT} objects, in frame order, with this exact shape:
[
  { "image_prompt": "...", "video_action": "...", "narration": "..." },
  ...
]
Do NOT wrap the JSON in markdown code fences (no \`\`\`json). Do NOT include any text, headers, or commentary before or after the array — the response must be valid JSON and nothing else.

CRITICAL: You must complete exactly ${FRAME_COUNT} frame objects. Under no circumstances should you repeat these instructions, echo any part of this prompt (including the tags above) into a field value, truncate early, or stop generating before closing the final JSON bracket.`;
}

// Defensive parsing: the prompt forbids markdown fences and stray text, but
// small models don't always comply, so strip fences and slice out the
// outermost [...] before parsing rather than trusting the raw output.
function parseStoryboard(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  const jsonSlice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;

  let frames;
  try {
    frames = JSON.parse(jsonSlice);
  } catch (err) {
    throw new Error(`Storyboard response wasn't valid JSON: ${err.message}`);
  }

  if (!Array.isArray(frames) || frames.length !== FRAME_COUNT) {
    throw new Error(
      `Expected a ${FRAME_COUNT}-frame storyboard array, got ${Array.isArray(frames) ? frames.length : typeof frames}`
    );
  }

  return frames.map((f, i) => {
    if (!f || typeof f !== "object") throw new Error(`Frame ${i + 1} is not an object`);
    for (const key of ["image_prompt", "video_action", "narration"]) {
      if (typeof f[key] !== "string" || !f[key].trim()) {
        throw new Error(`Frame ${i + 1} is missing "${key}"`);
      }
    }
    return {
      frame: i + 1,
      image_prompt: f.image_prompt.trim(),
      video_action: f.video_action.trim(),
      narration: f.narration.trim(),
    };
  });
}

export async function generateScript({ template, values, images }) {
  // `images` can be passed explicitly, or read off values.propertyImages —
  // the public R2 URLs of the photos uploaded in Step 0 (Add Assets).
  const propertyImages = images || values.propertyImages || [];
  const prompt = buildPrompt(values, template, propertyImages);
  // Low temperature — this needs to stick to the strict JSON structure, not
  // be creative about it. A model left free to improvise here is what
  // produced the prompt-leakage/truncation meltdown seen in testing.
  const raw = await callAnyLLM(prompt, { max_tokens: 4000, temperature: 0.2 });
  const frames = parseStoryboard(raw);
  const wordCount = frames.reduce((sum, f) => sum + f.narration.split(/\s+/).filter(Boolean).length, 0);
  return { frames, wordCount };
}
