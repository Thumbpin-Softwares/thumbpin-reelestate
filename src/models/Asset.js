import mongoose from "mongoose";

const AssetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["avatar", "product", "background", "video", "clip", "composite", "presenter"],
      required: true,
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

AssetSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Asset || mongoose.model("Asset", AssetSchema);
