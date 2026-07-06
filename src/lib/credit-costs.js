// Plain-data credit cost catalog — no server-only imports (DB/mongoose), so
// this is safe to import from both API routes (via credit-system.js) and
// client components that need to predict affordability before submitting.

export const FREE_QUOTA_LIMITS = {
  video: 2,
  avatar: 2,
};

export const CREDIT_ACTIONS = {
  generate_video: { cost: 2, freeBucket: "video", label: "Basic Video Generation" },
  text_to_video: { cost: 2, freeBucket: "video", label: "Text-to-Video" },
  image_to_video: { cost: 2, freeBucket: "video", label: "Image-to-Video" },
  ai_walkthrough: { cost: 2, freeBucket: "video", label: "AI Walkthrough" },
  product_video: { cost: 1, freeBucket: "video", label: "Product Video" },
  real_estate_video: { cost: 3, freeBucket: "video", label: "Real Estate Persona Video" },
  real_estate_video_batch: { cost: 3, freeBucket: "video", label: "Real Estate Batch Video", isBatch: true },
  action_reel_video: { cost: 4, freeBucket: "video", label: "Action Reel Video" },

  avatar_photo: { cost: 1, freeBucket: "avatar", label: "AI Photo Avatar" },
  avatar_looks: { cost: 1, freeBucket: "avatar", label: "Avatar Look Generation" },
  product_avatar_image: { cost: 1, freeBucket: "avatar", label: "Product Avatar Image" },

  image_generation: { cost: 1, freeBucket: null, label: "Image Generation" },
  gemini_image_generation: { cost: 1, freeBucket: null, label: "Gemini Image Generation" },

  avatar_group_training: { cost: 25, freeBucket: null, label: "Custom Avatar Training" },
  digital_twin_training: { cost: 25, freeBucket: null, label: "Digital Twin Training" },
};

/**
 * Client-side prediction of whether a user profile (from /api/user/profile,
 * shape: { plan, credits, freeVideoGenerationsUsed, freeAvatarGenerationsUsed })
 * can afford `action` — mirrors hasSufficientCreditsForAction's decision logic
 * (free-bucket first, then paid credits) without hitting the DB. This is only
 * a UX predictor for disabling buttons early; the server-side check is what
 * actually enforces it.
 */
export function canAffordAction({ profile, action }) {
  const config = CREDIT_ACTIONS[action];
  if (!config) return { ok: true };
  if (!profile) return { ok: false, required: config.cost || 0, credits: 0, label: config.label };

  const isFreePlan = (profile.plan || "free") === "free";
  if (isFreePlan && config.freeBucket) {
    const field =
      config.freeBucket === "video"
        ? "freeVideoGenerationsUsed"
        : config.freeBucket === "avatar"
        ? "freeAvatarGenerationsUsed"
        : null;
    const limit = FREE_QUOTA_LIMITS[config.freeBucket];
    const used = (field && profile[field]) || 0;
    if (field && used < limit) return { ok: true };
  }

  const cost = config.cost || 0;
  const credits = profile.credits ?? 0;
  if (cost <= 0 || credits >= cost) return { ok: true };

  return { ok: false, required: cost, credits, label: config.label };
}
