import mongoose, { Schema, models, model } from "mongoose";

const PolicyPageSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 60 }, // privacy | terms | refund-policy
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 200, default: "" },
    contentHtml: { type: String, default: "" }, // admin controlled HTML
    isEnabled: { type: Boolean, default: false }, // ✅ live pages use DB only when enabled
  },
  { timestamps: true }
);

PolicyPageSchema.index({ key: 1 }, { unique: true });

export default models.PolicyPage || model("PolicyPage", PolicyPageSchema);
