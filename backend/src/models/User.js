import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    airtableUserId: { type: String, required: true, index: true, unique: true },
    name: String,
    email: String,
    avatarUrl: String,
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    lastLoginAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);


