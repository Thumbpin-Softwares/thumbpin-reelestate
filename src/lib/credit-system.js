import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import CreditTransaction from "@/models/CreditTransaction";

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

  avatar_photo: { cost: 1, freeBucket: "avatar", label: "AI Photo Avatar" },
  avatar_looks: { cost: 1, freeBucket: "avatar", label: "Avatar Look Generation" },
  product_avatar_image: { cost: 1, freeBucket: "avatar", label: "Product Avatar Image" },

  image_generation: { cost: 1, freeBucket: null, label: "Image Generation" },
  gemini_image_generation: { cost: 1, freeBucket: null, label: "Gemini Image Generation" },

  avatar_group_training: { cost: 25, freeBucket: null, label: "Custom Avatar Training" },
  digital_twin_training: { cost: 25, freeBucket: null, label: "Digital Twin Training" },
};

/**
 * Calculate discounted batch cost for real estate video.
 * Single: 3 credits each (no discount)
 * 2 videos: ~15% off → 2.5 credits each → total 5
 * 3 videos: ~25% off → 2.25 credits each → total ~7 (rounded to 7)
 */
export function getBatchCost(action, batchSize = 1) {
  const config = CREDIT_ACTIONS[action];
  if (!config) return 0;
  const baseCost = config.cost;
  if (batchSize <= 1) return baseCost;
  if (batchSize === 2) return Math.round(baseCost * 2 * 0.85); // ~15% off total
  return Math.round(baseCost * batchSize * 0.75); // ~25% off total for 3+
}

function getFreeBucketField(bucket) {
  if (bucket === "video") return "freeVideoGenerationsUsed";
  if (bucket === "avatar") return "freeAvatarGenerationsUsed";
  return null;
}

async function logCreditEvent(payload) {
  try {
    await CreditTransaction.create(payload);
  } catch (error) {
    console.warn("[CreditSystem] Failed to log credit transaction:", error.message);
  }
}

function getActionOrThrow(action) {
  const config = CREDIT_ACTIONS[action];
  if (!config) {
    throw new Error(`Unknown credit action: ${action}`);
  }
  return config;
}

function buildQuotaSnapshot(user) {
  return {
    video: {
      used: user?.freeVideoGenerationsUsed || 0,
      limit: FREE_QUOTA_LIMITS.video,
      remaining: Math.max(0, FREE_QUOTA_LIMITS.video - (user?.freeVideoGenerationsUsed || 0)),
    },
    avatar: {
      used: user?.freeAvatarGenerationsUsed || 0,
      limit: FREE_QUOTA_LIMITS.avatar,
      remaining: Math.max(0, FREE_QUOTA_LIMITS.avatar - (user?.freeAvatarGenerationsUsed || 0)),
    },
  };
}

export function getCreditErrorPayload({ action, user }) {
  const config = getActionOrThrow(action);
  const quota = buildQuotaSnapshot(user);
  const requiredCredits = config.cost || 0;

  return {
    error: "Insufficient credits",
    message: `You need ${requiredCredits} credits for ${config.label}.`,
    requiredCredits,
    credits: user?.credits ?? 0,
    plan: user?.plan || "free",
    freeQuota: quota,
  };
}

export async function consumeCreditsForAction({ userId, action, metadata = {} }) {
  const config = getActionOrThrow(action);
  await dbConnect();

  const user = await User.findById(userId).select(
    "_id plan credits freeVideoGenerationsUsed freeAvatarGenerationsUsed"
  );

  if (!user) {
    return {
      ok: false,
      status: 404,
      payload: { error: "User not found" },
    };
  }

  const isFreePlan = (user.plan || "free") === "free";

  if (isFreePlan && config.freeBucket) {
    const field = getFreeBucketField(config.freeBucket);
    const limit = FREE_QUOTA_LIMITS[config.freeBucket];
    const used = user[field] || 0;

    if (field && used < limit) {
      const updated = await User.findOneAndUpdate(
        {
          _id: userId,
          plan: "free",
          [field]: { $lt: limit },
        },
        {
          $inc: { [field]: 1 },
        },
        { new: true }
      ).select("_id plan credits freeVideoGenerationsUsed freeAvatarGenerationsUsed");

      if (updated) {
        await logCreditEvent({
          userId,
          action,
          eventType: "free_quota_consumed",
          mode: "free_quota",
          creditsDelta: 0,
          balanceAfter: updated.credits,
          metadata: {
            ...metadata,
            bucket: config.freeBucket,
            used: updated[field],
            limit,
          },
        });

        return {
          ok: true,
          status: 200,
          debit: {
            mode: "free_quota",
            action,
            freeBucket: config.freeBucket,
            freeBucketField: field,
            freeBucketLimit: limit,
          },
          user: updated,
          freeQuota: buildQuotaSnapshot(updated),
        };
      }
    }
  }

  const cost = config.cost || 0;

  if (cost <= 0) {
    return {
      ok: true,
      status: 200,
      debit: {
        mode: "system",
        action,
        chargedCredits: 0,
      },
      user,
      freeQuota: buildQuotaSnapshot(user),
    };
  }

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      credits: { $gte: cost },
    },
    {
      $inc: { credits: -cost },
    },
    { new: true }
  ).select("_id plan credits freeVideoGenerationsUsed freeAvatarGenerationsUsed");

  if (!updated) {
    const latestUser = await User.findById(userId).select(
      "_id plan credits freeVideoGenerationsUsed freeAvatarGenerationsUsed"
    );

    return {
      ok: false,
      status: 402,
      payload: getCreditErrorPayload({ action, user: latestUser }),
      user: latestUser,
    };
  }

  await logCreditEvent({
    userId,
    action,
    eventType: "credits_debited",
    mode: "paid_credits",
    creditsDelta: -cost,
    balanceAfter: updated.credits,
    metadata,
  });

  return {
    ok: true,
    status: 200,
    debit: {
      mode: "paid_credits",
      action,
      chargedCredits: cost,
    },
    user: updated,
    freeQuota: buildQuotaSnapshot(updated),
  };
}

export async function refundCreditsForAction({ userId, action, debit, metadata = {} }) {
  if (!debit || debit.mode === "system") {
    return { ok: true, skipped: true };
  }

  await dbConnect();

  if (debit.mode === "free_quota" && debit.freeBucketField) {
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        [debit.freeBucketField]: { $gt: 0 },
      },
      {
        $inc: { [debit.freeBucketField]: -1 },
      },
      { new: true }
    ).select("_id plan credits freeVideoGenerationsUsed freeAvatarGenerationsUsed");

    if (updated) {
      await logCreditEvent({
        userId,
        action,
        eventType: "credits_refunded",
        mode: "free_quota",
        creditsDelta: 0,
        balanceAfter: updated.credits,
        metadata: {
          ...metadata,
          refundType: "free_quota_slot_restored",
          bucket: debit.freeBucket,
        },
      });
    }

    return { ok: true, user: updated || null };
  }

  if (debit.mode === "paid_credits") {
    const refundAmount = debit.chargedCredits || getActionOrThrow(action).cost || 0;
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { credits: refundAmount },
      },
      { new: true }
    ).select("_id plan credits freeVideoGenerationsUsed freeAvatarGenerationsUsed");

    if (updated) {
      await logCreditEvent({
        userId,
        action,
        eventType: "credits_refunded",
        mode: "paid_credits",
        creditsDelta: refundAmount,
        balanceAfter: updated.credits,
        metadata,
      });
    }

    return { ok: true, user: updated || null };
  }

  return { ok: true, skipped: true };
}

export async function addCredits({ userId, amount, action = "credits_topup", metadata = {} }) {
  if (!amount || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  await dbConnect();

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { credits: amount },
    },
    { new: true }
  ).select("_id credits");

  if (!user) {
    throw new Error("User not found");
  }

  await logCreditEvent({
    userId,
    action,
    eventType: "credits_added",
    mode: "system",
    creditsDelta: amount,
    balanceAfter: user.credits,
    metadata,
  });

  return user;
}
