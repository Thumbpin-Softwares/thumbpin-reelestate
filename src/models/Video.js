import mongoose from "mongoose";

const VideoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    video_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    script: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      required: true,
    },
    voiceId: {
      type: String,
      required: true,
    },
    musicEnabled: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["queued", "generating", "ready", "error", "processing", "completed", "failed"],
      default: "queued",
    },
    videoUrl: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Video || mongoose.model("Video", VideoSchema);
