import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    hashedPassword: {
      type: String,
      required: function() {
        return !this.googleId; // Required if not signed in with Google
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    image: {
      type: String,
    },
    credits: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeVideoGenerationsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeAvatarGenerationsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
