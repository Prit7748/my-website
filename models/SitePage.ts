import mongoose, { Schema, models, model } from "mongoose";

const SitePageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, unique: true, maxlength: 80 }, // e.g. "privacy"
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.SitePage || model("SitePage", SitePageSchema);