// models/User.ts
import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    // 🔐 Roles system
    role: {
      type: String,
      enum: ["user", "co_admin", "master_admin"],
      default: "user",
    },

    // 🔑 Co-Admin security key (hashed)
    adminKeyHash: {
      type: String,
      default: null,
    },

    // 🛡️ Permissions (future use)
    permissions: {
      type: [String],
      default: [],
    },

    // 🔢 Master Admin OTP (hashed)
    masterOtpHash: {
      type: String,
      default: null,
    },

    masterOtpExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Next.js dev hot-reload me model overwrite error se bachane ke liye
const User =
  mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
