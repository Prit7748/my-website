import mongoose, { Schema, models, model } from "mongoose";

const SocialLinkSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, trim: true, maxlength: 40, default: "" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SocialLinkSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

export default models.SocialLink || model("SocialLink", SocialLinkSchema);
