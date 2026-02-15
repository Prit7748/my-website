import mongoose, { Schema, models, model } from "mongoose";

const NoticeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true }, // can be internal OR full https://...
    badge: { type: String, default: "", trim: true },

    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 1000, index: true },

    // optional expiry (future use)
    expiresAt: { type: Date, default: null, index: true },

    lastModifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NoticeSchema.index({ isActive: 1, order: 1, createdAt: -1 });

export default models.Notice || model("Notice", NoticeSchema);
