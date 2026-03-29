import mongoose, { Schema, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

export const ON_DEMAND_DEFAULT_COURSE_KEY = "__DEFAULT__";

export function normalizeOnDemandTimingCategoryKey(input: any) {
  return safeStr(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()]/g, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOnDemandTimingCourseCode(input: any) {
  return safeStr(input).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

export function resolveOnDemandTimingCourseKey(input: any) {
  const code = normalizeOnDemandTimingCourseCode(input);
  return code || ON_DEMAND_DEFAULT_COURSE_KEY;
}

const OnDemandTimingRuleSchema = new Schema(
  {
    categoryLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    categoryKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
    },

    courseCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
    },

    courseCodeKey: {
      type: String,
      default: ON_DEMAND_DEFAULT_COURSE_KEY,
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
    },

    courseTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    ruleType: {
      type: String,
      enum: ["category_default", "course_override"],
      default: "category_default",
      index: true,
    },

    deliverWithinMinutes: {
      type: Number,
      default: 20,
      min: 1,
      max: 1440,
    },

    onDemandNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    lastModifiedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: true,
    strict: true,
  }
);

OnDemandTimingRuleSchema.pre("save", function () {
  const doc = this as any;

  doc.categoryLabel = safeStr(doc.categoryLabel);
  doc.categoryKey = normalizeOnDemandTimingCategoryKey(doc.categoryLabel || doc.categoryKey);

  doc.courseCode = normalizeOnDemandTimingCourseCode(doc.courseCode);
  doc.courseCodeKey = resolveOnDemandTimingCourseKey(doc.courseCode || doc.courseCodeKey);

  doc.courseTitle = safeStr(doc.courseTitle);
  doc.ruleType =
    doc.courseCodeKey && doc.courseCodeKey !== ON_DEMAND_DEFAULT_COURSE_KEY
      ? "course_override"
      : "category_default";

  doc.deliverWithinMinutes = Math.min(
    1440,
    Math.max(1, Math.trunc(Number(doc.deliverWithinMinutes || 20)))
  );

  doc.onDemandNote = safeStr(doc.onDemandNote);
  doc.updatedBy = safeStr(doc.updatedBy);
  doc.lastModifiedAt = new Date();
});

OnDemandTimingRuleSchema.index(
  { categoryKey: 1, courseCodeKey: 1 },
  { unique: true, name: "on_demand_timing_unique_rule_v2" }
);

OnDemandTimingRuleSchema.index(
  { categoryKey: 1, isActive: 1, ruleType: 1, courseCodeKey: 1 },
  { name: "on_demand_timing_lookup_v2" }
);

const ExistingModel =
  (mongoose.models &&
    (mongoose.models.OnDemandTimingRule as mongoose.Model<any> | undefined)) ||
  null;

const OnDemandTimingRule =
  ExistingModel &&
  ExistingModel.schema?.path("courseCodeKey") &&
  ExistingModel.schema?.path("categoryKey")
    ? ExistingModel
    : model("OnDemandTimingRule", OnDemandTimingRuleSchema);

export default OnDemandTimingRule;