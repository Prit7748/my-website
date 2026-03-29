import { Schema, models, model } from "mongoose";

const HandwritingSampleSchema = new Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    alt: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

HandwritingSampleSchema.index({ sortOrder: 1, createdAt: -1 });

export default models.HandwritingSample ||
  model("HandwritingSample", HandwritingSampleSchema);