import mongoose, { Schema, models, model } from "mongoose";

const TestimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    course: { type: String, required: true, trim: true, maxlength: 80 },
    text: { type: String, required: true, trim: true, maxlength: 600 },

    // optional enhancements (future-proof)
    rating: { type: Number, default: 5, min: 1, max: 5 },
    avatarUrl: { type: String, trim: true, default: "" },

    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 1000 },
  },
  { timestamps: true }
);

TestimonialSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

export default models.Testimonial || model("Testimonial", TestimonialSchema);
