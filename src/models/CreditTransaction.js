import mongoose from "mongoose";

const CreditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "free_quota_consumed",
        "credits_debited",
        "credits_refunded",
        "credits_added",
        "credits_set",
        "subscription_recharge",
        "admin_adjustment",
      ],
      required: true,
    },
    mode: {
      type: String,
      enum: ["free_quota", "paid_credits", "system", "admin"],
      required: true,
    },
    creditsDelta: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.CreditTransaction ||
  mongoose.model("CreditTransaction", CreditTransactionSchema);
