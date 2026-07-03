import mongoose, { Schema, models, model } from "mongoose";

const RedirectionSchema = new Schema(
  {
    fromPath: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 2048,
    },
    toPath: { type: String, required: true, trim: true, maxlength: 2048 },
    statusCode: { type: Number, enum: [301, 302], default: 301 },
    isActive: { type: Boolean, default: true, index: true },
    note: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

RedirectionSchema.index({ isActive: 1, fromPath: 1 });

export default models.Redirection || model("Redirection", RedirectionSchema);
