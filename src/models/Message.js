import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    // Only the recipient side's flag matters — a user message is unread by
    // the admin inbox until an admin opens it, and vice versa.
    readByAdmin: {
      type: Boolean,
      default: false,
    },
    readByUser: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
