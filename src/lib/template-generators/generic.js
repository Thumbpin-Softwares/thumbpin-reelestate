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

// ─── Asset-Anchored Architecture ───────────────────────────────────────
// The storyboard is no longer allowed to invent a property or a presenter.
// Every frame must be pinned to one of the user's own uploaded property
// photos (by index, resolved to a URL in parseStoryboard — asking a small
// model to retype a long URL verbatim is unreliable, an index into a
// numbered list is not) and the user's own chosen avatar image. Gender is
// never guessed by this step either — it's a UI-provided flag threaded
// straight through to Veo in generate-videos.js.
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

  const visualAssetsBlock = images.map((url, i) => `${i + 1}. ${url}`).join("\n");

  // Variable/user-controlled content is wrapped in XML-style tags and kept
  // separate from the instructions around it — this keeps the model from
  // confusing "content to reason about" with "instructions to follow" (the
  // confusion that previously caused it to paste prompt text into a
  // video_action field instead of writing one).
  return `You are a storyboarder who must STRICTLY use the provided assets. You are not a photographer and not a casting director — you never invent a building, a room, or a person that isn't already provided below. You are storyboarding "${template.title}" as a sequence of exactly ${FRAME_COUNT} frames (${SECONDS_PER_FRAME} seconds each, ${FRAME_COUNT * SECONDS_PER_FRAME}s total), 9:16 VERTICAL MOBILE VIDEO AD (Reels/Shorts format).

<property_details>
${detailLines.join("\n")}
</property_details>

<property_images>
${visualAssetsBlock}
</property_images>

<client_direction>
${values.tonality || "n/a"}
</client_direction>

HOW THIS AD MUST FEEL — combine both of these, they are not optional:
1. Price tier (${values.projectType || "n/a"}): ${tierTone}
2. Listing type (${values.propertyClassification || "n/a"}): ${classificationTone}

NARRATION LANGUAGE: ${langInstruction}

ASSET-ANCHORING RULES — MANDATORY, NOT OPTIONAL:
- Do NOT describe a new character. There is exactly one presenter across the whole ad — the user's own uploaded avatar photo — and it appears in every frame. Never invent hair color, wardrobe, age, or facial features for the presenter; that is decided by the actual reference photo, not by you.
- Map every single frame to exactly ONE of the numbered images listed in <property_images> above. You must pick the number (1 to ${images.length}) of the property photo each frame's scene is set in/around — never a scene that isn't grounded in one of these numbered photos.
- Do not invent a room, view, or architectural feature that isn't visible in the numbered property photos.

FORMAT — 9:16 VERTICAL, NOT OPTIONAL: Every frame is composed for a tall vertical phone screen, not widescreen. Frame every image_prompt as a vertical composition (portrait orientation, tall foreground subject filling the frame, headroom and footroom considered).
Completely avoid horizontal-framing language — never write "wide sweeping pan", "wide landscape shot", "wide establishing shot", or anything implying a horizontal cinematic frame.
Instead, video_action must use vertical-native camera movements: slow vertical tilts (floor to ceiling / ceiling to floor), push-ins, upward drone ascents tracking the building's height, and tracking shots that follow vertical lines and luxury textures (columns, facades, staircases) rather than sweeping sideways.

IN-SCENE PRESENTER — MANDATORY, NOT OPTIONAL: The presenter (the user's own avatar) is visible, moving, and lip-syncing the narration in every single frame — this is not a b-roll/architecture-only ad. Every frame's image_prompt MUST explicitly include this exact framing: "A cinematic medium-close-up of the presenter facing directly at the camera, standing in ${values.location || "the property"}." Build the rest of the shot's description (lighting, mood, background detail) around that mandatory sentence — never drop it, never replace it with a wide or profile shot, and never generate a frame where the presenter's face is small, turned away, or absent.

For EACH of the ${FRAME_COUNT} frames, decide:
1. reference_image_index — the number (integer, 1 to ${images.length}) of the <property_images> photo this frame's scene is set in. Every frame must have one; pick the closest match, never omit it.
2. image_prompt — a detailed vertical (9:16) visual prompt for an image-generation model: open with the mandatory presenter framing sentence above, then describe the rest of the shot (setting, lighting, mood, background) grounded strictly in the property photo you picked for reference_image_index. Compose it for a tall vertical frame, not a wide one.
3. video_action — a short vertical-native motion/camera-movement prompt for an image-to-video model (Veo): tilts, push-ins, upward ascents, or vertical tracking shots only — no horizontal pans or wide sweeping moves. Describe ONLY the camera/subject movement in your own words — never copy, quote, or reference any instructions, tags, or text from this prompt itself.
4. narration — the spoken voiceover line for this frame only, in NARRATION LANGUAGE, natural and speakable in about ${SECONDS_PER_FRAME} seconds (roughly 12–18 words). Across all ${FRAME_COUNT} frames the narration must read as one continuous, escalating script. Frame 1's hook is the most important line in the whole ad — vertical short-form video lives or dies in the first second of a scroll, so it must be punchy, hyper-engaging, and immediately scroll-stopping (a bold claim, a striking question, or an arresting statement — not a slow warm-up). Build highlights through the middle frames, and close with a strong call-to-action in the final frame.

Reflect the price tier and listing type tone above in both the visual direction (image_prompt/video_action) and the narration word choice — not just the subject matter.

OUTPUT FORMAT — STRICT:
Return ONLY a raw JSON array of exactly ${FRAME_COUNT} objects, in frame order, with this exact shape:
[
  { "reference_image_index": 1, "image_prompt": "...", "video_action": "...", "narration": "..." },
  ...
]
Do NOT wrap the JSON in markdown code fences (no \`\`\`json). Do NOT include any text, headers, or commentary before or after the array — the response must be valid JSON and nothing else.

CRITICAL: You must complete exactly ${FRAME_COUNT} frame objects, every one carrying a valid reference_image_index. Under no circumstances should you repeat these instructions, echo any part of this prompt (including the tags above) into a field value, truncate early, or stop generating before closing the final JSON bracket.`;
}

// Defensive parsing: the prompt forbids markdown fences and stray text, but
// small models don't always comply, so strip fences and slice out the
// outermost [...] before parsing rather than trusting the raw output.
//
// Asset-anchored: reference_image_index is validated against the actual
// propertyImages array and resolved to a URL here — never trusted as
// free-text from the model, and never defaulted if missing/out of range.
// avatar_url is not something the LLM decides at all — every frame uses
// the SAME user-provided avatarImage, so it's attached deterministically.
function parseStoryboard(raw, propertyImages, avatarImage) {
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

    const index = Number(f.reference_image_index);
    if (!Number.isInteger(index) || index < 1 || index > propertyImages.length) {
      throw new Error(
        `Frame ${i + 1} is missing a valid reference_image_index (got ${JSON.stringify(f.reference_image_index)}) — refusing to default to a generic/invented scene`
      );
    }

    return {
      frame: i + 1,
      image_prompt: f.image_prompt.trim(),
      video_action: f.video_action.trim(),
      narration: f.narration.trim(),
      reference_image_url: propertyImages[index - 1],
      avatar_url: avatarImage,
    };
  });
}

export async function generateScript({ template, values, images, avatarImage }) {
  // `images`/`avatarImage` can be passed explicitly, or read off
  // values.propertyImages / values.avatarImage — the assets picked in
  // Step 0 (Add Assets). Asset-anchored architecture: there is no
  // generic/fallback storyboard when these are missing — every scene must
  // be pinned to a real uploaded photo and the user's own avatar.
  const propertyImages = images || values.propertyImages || [];
  const avatarUrl = avatarImage || values.avatarImage;
  if (propertyImages.length === 0) {
    throw new Error("generateScript requires at least one property image — asset-anchored storyboards cannot invent a property");
  }
  if (!avatarUrl) {
    throw new Error("generateScript requires an avatarImage — asset-anchored storyboards cannot invent a presenter");
  }

  const prompt = buildPrompt(values, template, propertyImages);
  // Low temperature — this needs to stick to the strict JSON structure, not
  // be creative about it. A model left free to improvise here is what
  // produced the prompt-leakage/truncation meltdown seen in testing.
  const raw = await callAnyLLM(prompt, { max_tokens: 4000, temperature: 0.2 });
  const frames = parseStoryboard(raw, propertyImages, avatarUrl);
  const wordCount = frames.reduce((sum, f) => sum + f.narration.split(/\s+/).filter(Boolean).length, 0);
  return { frames, wordCount };
}
