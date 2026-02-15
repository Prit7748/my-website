import mongoose, { Schema, models, model } from "mongoose";

const FaqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 220 },
    answer: { type: String, required: true, trim: true, maxlength: 4000 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FaqSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

export default models.Faq || model("Faq", FaqSchema);
