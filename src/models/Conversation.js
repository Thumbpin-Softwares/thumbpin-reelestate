import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one support chat thread per user
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    lastMessagePreview: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ status: 1, lastMessageAt: -1 });

export default mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
