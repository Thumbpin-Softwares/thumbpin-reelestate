import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
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
    description: {
      type: String,
      required: true,
    },
    targetAudience: {
      type: String,
    },
    tone: {
      type: String,
    },
    images: [{
      type: String, // URLs to images stored in Supabase
    }],
    scripts: [{
      type: String,
    }],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
