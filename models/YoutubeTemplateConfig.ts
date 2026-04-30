import { Schema, models, model } from "mongoose";

export const YOUTUBE_TEMPLATE_CONFIG_KEY = "youtube_template_config_v1";

export const YOUTUBE_TEMPLATE_KINDS = ["assignment", "pyq"] as const;
export type YoutubeTemplateKind = (typeof YOUTUBE_TEMPLATE_KINDS)[number];

export const YOUTUBE_TOKEN_HELP = [
  { token: "%1", label: "Subject Code", example: "BCOS 186" },
  { token: "%2", label: "Subject Title", example: "Personal Selling and Salesmanship" },
  { token: "%3", label: "Course Codes", example: "BCOMG" },
  { token: "%4", label: "Course Titles", example: "Bachelor of Commerce - General" },
  { token: "%5", label: "Session", example: "July 2025" },
  { token: "%6", label: "Medium", example: "Hindi" },
  { token: "%7", label: "Product Link", example: "https://www.istudentsportal.com/..." },
  { token: "%8", label: "Product Title", example: "IGNOU BCOS 186 Solved Assignment..." },
  { token: "%9", label: "Category", example: "Solved Assignments" },
  { token: "%10", label: "Unique ID / SKU", example: "BCOS186HINJUL25A" },
  { token: "%11", label: "Website Name", example: "IGNOU Students Portal" },
  { token: "%12", label: "Website Home Link", example: "https://www.istudentsportal.com" },
] as const;

export type YoutubeTextTemplateBlock = {
  isEnabled: boolean;
  titleTemplate: string;
  descriptionTemplate: string;
  pinnedCommentTemplate: string;
};

export type YoutubeThumbnailTextField = {
  key: string;
  label: string;
  enabled: boolean;
  token: string;
  fallbackText: string;
  x: number;
  y: number;
  width: number;
  maxLines: number;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  uppercase: boolean;
};

export type YoutubeThumbnailTemplateBlock = {
  isEnabled: boolean;
  templateImageUrl: string;
  width: number;
  height: number;
  outputFilePrefix: string;
  fields: YoutubeThumbnailTextField[];
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;

  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }

  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }

  return def;
}

function clampNum(x: any, def: number, min: number, max: number) {
  const n = safeNum(x, def);
  return Math.min(max, Math.max(min, n));
}

function normalizeHexColor(input: any, fallback: string) {
  const raw = safeStr(input);
  if (/^#[0-9a-f]{3}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return fallback;
}

function normalizeAlign(input: any): "left" | "center" | "right" {
  const raw = safeStr(input).toLowerCase();
  if (raw === "left" || raw === "center" || raw === "right") return raw;
  return "center";
}

function normalizeField(field: any): YoutubeThumbnailTextField {
  return {
    key: safeStr(field?.key).slice(0, 80) || "field",
    label: safeStr(field?.label).slice(0, 120) || "Field",
    enabled: safeBool(field?.enabled, true),
    token: safeStr(field?.token).slice(0, 20) || "",
    fallbackText: safeStr(field?.fallbackText).slice(0, 300) || "",
    x: clampNum(field?.x, 640, 0, 1280),
    y: clampNum(field?.y, 360, 0, 720),
    width: clampNum(field?.width, 900, 50, 1280),
    maxLines: Math.trunc(clampNum(field?.maxLines, 1, 1, 5)),
    fontSize: Math.trunc(clampNum(field?.fontSize, 54, 10, 180)),
    minFontSize: Math.trunc(clampNum(field?.minFontSize, 24, 8, 120)),
    lineHeight: clampNum(field?.lineHeight, 1.18, 0.8, 2),
    letterSpacing: clampNum(field?.letterSpacing, 0, -5, 20),
    fontFamily:
      safeStr(field?.fontFamily).slice(0, 200) ||
      "Arial, Helvetica, sans-serif",
    fontWeight: Math.trunc(clampNum(field?.fontWeight, 900, 100, 900)),
    color: normalizeHexColor(field?.color, "#111111"),
    align: normalizeAlign(field?.align),
    uppercase: safeBool(field?.uppercase, false),
  };
}

export const DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES: YoutubeTextTemplateBlock = {
  isEnabled: true,
  titleTemplate:
    "IGNOU %1 Solved Assignment %5 | %6 Medium | Download PDF",
  descriptionTemplate:
    "📢 Get IGNOU %1 Solved Assignment %5 in %6 Medium.\n\n📌 Subject Code: %1\n📌 Subject Title: %2\n📌 Course: %3\n📌 Medium: %6\n📌 Session: %5\n\n✅ Download Now:\n%7\n\n🌐 Visit Website:\n%12\n\nAt %11, students can find IGNOU solved assignments, previous year question papers, guess papers, ebooks, notes, handwritten PDFs and hardcopy assignment delivery support.\n\n#IGNOU #IGNOUAssignments #SolvedAssignment #%1",
  pinnedCommentTemplate:
    "📌 Download IGNOU %1 Solved Assignment %5 (%6 Medium): %7\n\nVisit %11 for more IGNOU study material: %12",
};

export const DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES: YoutubeTextTemplateBlock = {
  isEnabled: true,
  titleTemplate:
    "IGNOU %1 Solved Previous Year Paper | %6 Medium | Download PDF",
  descriptionTemplate:
    "📢 Get IGNOU %1 Solved Previous Year Paper in %6 Medium.\n\n📌 Subject Code: %1\n📌 Subject Title: %2\n📌 Course: %3\n📌 Medium: %6\n📌 Session: %5\n\n✅ Download Now:\n%7\n\n🌐 Visit Website:\n%12\n\nAt %11, students can find IGNOU solved assignments, solved PYQs, guess papers, ebooks, notes, handwritten PDFs and hardcopy assignment delivery support.\n\n#IGNOU #IGNOUPYQ #IGNOUQuestionPaper #%1",
  pinnedCommentTemplate:
    "📌 Download IGNOU %1 Solved PYQ / Previous Year Paper (%6 Medium): %7\n\nVisit %11 for more IGNOU exam material: %12",
};

export const DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL: YoutubeThumbnailTemplateBlock = {
  isEnabled: true,
  templateImageUrl: "",
  width: 1280,
  height: 720,
  outputFilePrefix: "ignou-assignment-youtube-thumbnail",
  fields: [
    {
      key: "subjectCode",
      label: "Subject Code",
      enabled: true,
      token: "%1",
      fallbackText: "BCOS 186",
      x: 640,
      y: 320,
      width: 900,
      maxLines: 1,
      fontSize: 92,
      minFontSize: 48,
      lineHeight: 1.1,
      letterSpacing: 1,
      fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#ffffff",
      align: "center",
      uppercase: true,
    },
    {
      key: "subjectTitle",
      label: "Subject Title",
      enabled: true,
      token: "%2",
      fallbackText: "Personal Selling and Salesmanship",
      x: 640,
      y: 425,
      width: 980,
      maxLines: 2,
      fontSize: 42,
      minFontSize: 24,
      lineHeight: 1.18,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 800,
      color: "#ffffff",
      align: "center",
      uppercase: false,
    },
    {
      key: "session",
      label: "Session",
      enabled: true,
      token: "%5",
      fallbackText: "July 2025",
      x: 300,
      y: 565,
      width: 360,
      maxLines: 1,
      fontSize: 34,
      minFontSize: 22,
      lineHeight: 1.1,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#111111",
      align: "center",
      uppercase: true,
    },
    {
      key: "medium",
      label: "Medium",
      enabled: true,
      token: "%6",
      fallbackText: "Hindi",
      x: 980,
      y: 565,
      width: 360,
      maxLines: 1,
      fontSize: 34,
      minFontSize: 22,
      lineHeight: 1.1,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#111111",
      align: "center",
      uppercase: true,
    },
    {
      key: "courseCodes",
      label: "Course Codes",
      enabled: true,
      token: "%3",
      fallbackText: "BCOMG",
      x: 640,
      y: 630,
      width: 560,
      maxLines: 1,
      fontSize: 28,
      minFontSize: 18,
      lineHeight: 1.1,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#ffffff",
      align: "center",
      uppercase: true,
    },
  ],
};

export const DEFAULT_YOUTUBE_PYQ_THUMBNAIL: YoutubeThumbnailTemplateBlock = {
  isEnabled: true,
  templateImageUrl: "",
  width: 1280,
  height: 720,
  outputFilePrefix: "ignou-pyq-youtube-thumbnail",
  fields: [
    {
      key: "subjectCode",
      label: "Subject Code",
      enabled: true,
      token: "%1",
      fallbackText: "BCOS 186",
      x: 640,
      y: 315,
      width: 900,
      maxLines: 1,
      fontSize: 92,
      minFontSize: 48,
      lineHeight: 1.1,
      letterSpacing: 1,
      fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#ffffff",
      align: "center",
      uppercase: true,
    },
    {
      key: "subjectTitle",
      label: "Subject Title",
      enabled: true,
      token: "%2",
      fallbackText: "Personal Selling and Salesmanship",
      x: 640,
      y: 420,
      width: 980,
      maxLines: 2,
      fontSize: 40,
      minFontSize: 23,
      lineHeight: 1.18,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 800,
      color: "#ffffff",
      align: "center",
      uppercase: false,
    },
    {
      key: "session",
      label: "Session",
      enabled: true,
      token: "%5",
      fallbackText: "June 2025",
      x: 300,
      y: 565,
      width: 360,
      maxLines: 1,
      fontSize: 34,
      minFontSize: 22,
      lineHeight: 1.1,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#111111",
      align: "center",
      uppercase: true,
    },
    {
      key: "medium",
      label: "Medium",
      enabled: true,
      token: "%6",
      fallbackText: "English",
      x: 980,
      y: 565,
      width: 360,
      maxLines: 1,
      fontSize: 34,
      minFontSize: 22,
      lineHeight: 1.1,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#111111",
      align: "center",
      uppercase: true,
    },
    {
      key: "courseCodes",
      label: "Course Codes",
      enabled: true,
      token: "%3",
      fallbackText: "BCOMG",
      x: 640,
      y: 630,
      width: 560,
      maxLines: 1,
      fontSize: 28,
      minFontSize: 18,
      lineHeight: 1.1,
      letterSpacing: 0,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 900,
      color: "#ffffff",
      align: "center",
      uppercase: true,
    },
  ],
};

export const DEFAULT_YOUTUBE_TEMPLATE_CONFIG = {
  assignment: DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES,
  pyq: DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES,
  assignmentThumbnail: DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL,
  pyqThumbnail: DEFAULT_YOUTUBE_PYQ_THUMBNAIL,
};

const YoutubeTextTemplateBlockSchema = new Schema(
  {
    isEnabled: {
      type: Boolean,
      default: true,
    },

    titleTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    descriptionTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 12000,
    },

    pinnedCommentTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },
  },
  { _id: false }
);

const YoutubeThumbnailTextFieldSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    label: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    token: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
    },

    fallbackText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    x: {
      type: Number,
      default: 640,
      min: 0,
      max: 1280,
    },

    y: {
      type: Number,
      default: 360,
      min: 0,
      max: 720,
    },

    width: {
      type: Number,
      default: 900,
      min: 50,
      max: 1280,
    },

    maxLines: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },

    fontSize: {
      type: Number,
      default: 54,
      min: 10,
      max: 180,
    },

    minFontSize: {
      type: Number,
      default: 24,
      min: 8,
      max: 120,
    },

    lineHeight: {
      type: Number,
      default: 1.18,
      min: 0.8,
      max: 2,
    },

    letterSpacing: {
      type: Number,
      default: 0,
      min: -5,
      max: 20,
    },

    fontFamily: {
      type: String,
      default: "Arial, Helvetica, sans-serif",
      trim: true,
      maxlength: 200,
    },

    fontWeight: {
      type: Number,
      default: 900,
      min: 100,
      max: 900,
    },

    color: {
      type: String,
      default: "#111111",
      trim: true,
      maxlength: 20,
    },

    align: {
      type: String,
      enum: ["left", "center", "right"],
      default: "center",
    },

    uppercase: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const YoutubeThumbnailTemplateBlockSchema = new Schema(
  {
    isEnabled: {
      type: Boolean,
      default: true,
    },

    templateImageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    width: {
      type: Number,
      default: 1280,
      min: 1280,
      max: 1280,
    },

    height: {
      type: Number,
      default: 720,
      min: 720,
      max: 720,
    },

    outputFilePrefix: {
      type: String,
      default: "ignou-youtube-thumbnail",
      trim: true,
      maxlength: 120,
    },

    fields: {
      type: [YoutubeThumbnailTextFieldSchema],
      default: [],
    },
  },
  { _id: false }
);

const YoutubeTemplateConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: YOUTUBE_TEMPLATE_CONFIG_KEY,
      index: true,
    },

    assignment: {
      type: YoutubeTextTemplateBlockSchema,
      default: () => DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES,
    },

    pyq: {
      type: YoutubeTextTemplateBlockSchema,
      default: () => DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES,
    },

    assignmentThumbnail: {
      type: YoutubeThumbnailTemplateBlockSchema,
      default: () => DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL,
    },

    pyqThumbnail: {
      type: YoutubeThumbnailTemplateBlockSchema,
      default: () => DEFAULT_YOUTUBE_PYQ_THUMBNAIL,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

YoutubeTemplateConfigSchema.pre("save", function () {
  const doc = this as any;

  doc.key = safeStr(doc.key || YOUTUBE_TEMPLATE_CONFIG_KEY) || YOUTUBE_TEMPLATE_CONFIG_KEY;
  doc.updatedBy = safeStr(doc.updatedBy);

  const normalizeTextBlock = (
    block: any,
    defaults: YoutubeTextTemplateBlock
  ): YoutubeTextTemplateBlock => {
    return {
      isEnabled: safeBool(block?.isEnabled, defaults.isEnabled),
      titleTemplate:
        safeStr(block?.titleTemplate) || defaults.titleTemplate,
      descriptionTemplate:
        safeStr(block?.descriptionTemplate) || defaults.descriptionTemplate,
      pinnedCommentTemplate:
        safeStr(block?.pinnedCommentTemplate) || defaults.pinnedCommentTemplate,
    };
  };

  const normalizeThumbnailBlock = (
    block: any,
    defaults: YoutubeThumbnailTemplateBlock
  ): YoutubeThumbnailTemplateBlock => {
    const inputFields = Array.isArray(block?.fields) ? block.fields : [];
    const defaultFields = Array.isArray(defaults.fields) ? defaults.fields : [];

    const normalizedFields =
      inputFields.length > 0
        ? inputFields.map((field: any) => normalizeField(field))
        : defaultFields.map((field) => normalizeField(field));

    return {
      isEnabled: safeBool(block?.isEnabled, defaults.isEnabled),
      templateImageUrl: safeStr(block?.templateImageUrl || defaults.templateImageUrl),
      width: 1280,
      height: 720,
      outputFilePrefix:
        safeStr(block?.outputFilePrefix) || defaults.outputFilePrefix,
      fields: normalizedFields,
    };
  };

  doc.assignment = normalizeTextBlock(
    doc.assignment,
    DEFAULT_YOUTUBE_ASSIGNMENT_TEXT_TEMPLATES
  );

  doc.pyq = normalizeTextBlock(
    doc.pyq,
    DEFAULT_YOUTUBE_PYQ_TEXT_TEMPLATES
  );

  doc.assignmentThumbnail = normalizeThumbnailBlock(
    doc.assignmentThumbnail,
    DEFAULT_YOUTUBE_ASSIGNMENT_THUMBNAIL
  );

  doc.pyqThumbnail = normalizeThumbnailBlock(
    doc.pyqThumbnail,
    DEFAULT_YOUTUBE_PYQ_THUMBNAIL
  );
});

export default models.YoutubeTemplateConfig ||
  model("YoutubeTemplateConfig", YoutubeTemplateConfigSchema);