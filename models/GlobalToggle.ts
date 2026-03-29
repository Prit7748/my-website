// models/GlobalToggle.ts
import mongoose, { Schema, models, model } from "mongoose";

const GlobalToggleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true, trim: true }, // e.g. "coming_soon_sales"
    enabled: { type: Boolean, default: true, index: true },
    note: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

GlobalToggleSchema.index({ key: 1 }, { unique: true });

export default models.GlobalToggle || model("GlobalToggle", GlobalToggleSchema);