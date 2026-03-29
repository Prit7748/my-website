import mongoose, { Schema, models, model } from "mongoose";

const SessionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    slug: { type: String, required: true, unique: true, trim: true },

    categories: { type: [String], default: [], index: true },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SessionSchema.index(
  { name: "text", slug: "text", categories: "text" },
  { name: "session_text_search_v1", default_language: "none" }
);

export default models.Session || model("Session", SessionSchema);