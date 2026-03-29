// ✅ FILE: models/Session.ts (COMPLETE REPLACE)
import mongoose, { Schema, models, model } from "mongoose";

const SessionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "2025-2026", "June 2023", "Latest"

    // slug will be generated in API (POST/PUT) — no schema hook
    slug: { type: String, required: true, unique: true, index: true, trim: true },

    // category slugs where this session is applicable
    categories: { type: [String], default: [], index: true },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ (Optional) text search — if it causes TS issue in your setup, remove it.
// Keeping it consistent with Subject.ts:
SessionSchema.index(
  { name: "text", slug: "text", categories: "text" },
  { name: "session_text_search_v1", default_language: "none" }
);

export default models.Session || model("Session", SessionSchema);