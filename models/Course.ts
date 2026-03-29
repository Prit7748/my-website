import mongoose, { Schema, models, model } from "mongoose";

const CourseSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true }, // e.g. "BCA 001"
    title: { type: String, default: "" }, // single title (Hindi/English/Other - only one)
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Text search
CourseSchema.index(
  { code: "text", title: "text" },
  { name: "course_text_search_v1", default_language: "none" }
);

export default models.Course || model("Course", CourseSchema);