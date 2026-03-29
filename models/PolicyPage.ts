import mongoose, { Schema, models, model } from "mongoose";

const PolicyPageSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 200, default: "" },
    contentHtml: { type: String, default: "" },
    isEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default models.PolicyPage || model("PolicyPage", PolicyPageSchema);