import mongoose, { Schema, models, model } from "mongoose";

const SitePageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, unique: true, maxlength: 80 }, // e.g. "privacy"
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, default: "" }, // HTML/Markdown/text (your choice)
    isActive: { type: Boolean, default: false }, // ✅ only when enabled
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

SitePageSchema.index({ key: 1 }, { unique: true });

export default models.SitePage || model("SitePage", SitePageSchema);
