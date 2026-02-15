import mongoose, { Schema, models, model } from "mongoose";

const BlogCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, unique: true, maxlength: 120, index: true },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

BlogCategorySchema.index({ slug: 1 }, { unique: true });
BlogCategorySchema.index({ isActive: 1, sortOrder: 1 });

export default models.BlogCategory || model("BlogCategory", BlogCategorySchema);
