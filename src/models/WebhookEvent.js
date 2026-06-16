import mongoose from "mongoose";

const WebhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

WebhookEventSchema.index({ provider: 1, eventId: 1, eventType: 1 }, { unique: true });

export default mongoose.models.WebhookEvent || mongoose.model("WebhookEvent", WebhookEventSchema);
