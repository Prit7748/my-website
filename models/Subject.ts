// ✅ FILE: models/Subject.ts (COMPLETE REPLACE)
import mongoose, { Schema, models, model } from "mongoose";

const SubjectSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true, trim: true }, // e.g. "BCHCT 131"

    titleEn: { type: String, default: "" },
    titleHi: { type: String, default: "" },

    // ✅ Other language support (name + title)
    otherLangName: { type: String, default: "" }, // e.g. "Bengali", "Urdu", "Tamil"
    titleOther: { type: String, default: "" }, // title in that language

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// ✅ Text search index (keep)
SubjectSchema.index(
  { code: "text", titleEn: "text", titleHi: "text", otherLangName: "text", titleOther: "text" },
  { name: "subject_text_search_v2", default_language: "none" }
);

// ❌ Removed duplicate: SubjectSchema.index({ code: 1 }, { unique: true });

export default models.Subject || model("Subject", SubjectSchema);
