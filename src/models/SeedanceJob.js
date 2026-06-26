import mongoose from "mongoose";

const SeedanceJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["running", "splitting", "voices", "seedance", "combining", "done", "error"],
      default: "running",
    },
    part1: String,
    part2: String,
    part3Cta: String,
    part1AudioUrl: String,
    part2AudioUrl: String,
    part3AudioUrl: String,
    avatarVideoUrl: String,
    walkthroughVideoUrl: String,
    ctaVideoUrl: String,
    part1VideoUrl: String,
    part2VideoUrl: String,
    error: String,
  },
  {
    timestamps: true,
  }
);

SeedanceJobSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.SeedanceJob || mongoose.model("SeedanceJob", SeedanceJobSchema);
