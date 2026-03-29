import mongoose, { Schema, models, model } from "mongoose";

const PHYSICAL_CATEGORY = "Handwritten Hardcopy (Delivery)";

function normalizeAvailabilityValue(input: any): "available" | "on_demand" | "want_to_buy" {
  const av = String(input || "").trim().toLowerCase();

  if (av === "coming_soon" || av === "comingsoon" || av === "coming-soon") {
    return "on_demand";
  }

  if (av === "out_of_stock" || av === "outofstock" || av === "out-of-stock") {
    return "want_to_buy";
  }

  if (av === "on_demand" || av === "on demand") {
    return "on_demand";
  }

  if (av === "want_to_buy" || av === "want to buy") {
    return "want_to_buy";
  }

  return "available";
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function deriveIsDigitalFromCategory(category: any) {
  return safeStr(category) !== PHYSICAL_CATEGORY;
}

const ProductSchema = new Schema(
  {
    // =========================
    // Identity
    // =========================
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      maxlength: 400,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    // =========================
    // Category
    // =========================
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 120,
    },

    // =========================
    // Subject
    // =========================
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 40,
    },

    subjectTitleHi: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    subjectTitleEn: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    subjectTitleOther: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    // =========================
    // Course mapping
    // =========================
    courseCodes: {
      type: [String],
      default: [],
      index: true,
    },

    courseTitles: {
      type: [String],
      default: [],
    },

    // =========================
    // Session + Language
    // =========================
    session: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 30,
    },

    session6: {
      type: String,
      default: "",
      trim: true,
      index: true,
      maxlength: 6,
      validate: {
        validator: function (v: string) {
          return !v || /^\d{6}$/.test(String(v));
        },
        message: "session6 must be empty or 6 digits",
      },
    },

    language: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 30,
    },

    lang3: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
      minlength: 3,
      maxlength: 3,
    },

    // =========================
    // Pricing
    // =========================
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    oldPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================
    // Extra / product state
    // =========================
    pages: {
      type: Number,
      default: 0,
      min: 0,
    },

    availability: {
      type: String,
      enum: ["available", "on_demand", "want_to_buy"],
      default: "available",
      index: true,
      set: normalizeAvailabilityValue,
    },

    // On Demand config
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
      maxlength: 2000,
    },

    autoMakeAvailableOnUpload: {
      type: Boolean,
      default: true,
    },

    importantNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    // =========================
    // Description
    // =========================
    shortDesc: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },

    descriptionHtml: {
      type: String,
      default: "",
    },

    // =========================
    // Digital delivery
    // =========================
    isDigital: {
      type: Boolean,
      default: true,
    },

    // PRIVATE S3 key (preferred)
    pdfKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    // legacy support (optional)
    pdfUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    // =========================
    // Images
    // =========================
    images: {
      type: [String],
      default: [],
    },

    thumbnailUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    quickUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    // =========================
    // SEO
    // =========================
    metaTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    metaDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // =========================
    // Auto-generation tracking
    // =========================
    isAutoGenerated: {
      type: Boolean,
      default: false,
      index: true,
    },

    autoGenerationType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },

    autoGeneratedFromProductId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    autoGeneratedFromSku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 80,
      index: true,
    },

    autoGeneratedFromCategory: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    autoGeneratedAt: {
      type: Date,
      default: null,
      index: true,
    },

    // =========================
    // Publish / audit
    // =========================
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastModifiedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Soft delete / trash
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    deletedBy: {
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

/* =========================
   Normalize arrays before save
   ========================= */
ProductSchema.pre("save", function () {
  const doc = this as any;

  const cleanArr = (arr: any) =>
    Array.isArray(arr)
      ? Array.from(
          new Set(
            arr
              .map((x: any) => String(x ?? "").trim())
              .filter(Boolean)
          )
        )
      : [];

  doc.courseCodes = cleanArr(doc.courseCodes).map((x: string) => x.toUpperCase());
  doc.courseTitles = cleanArr(doc.courseTitles);
  doc.images = cleanArr(doc.images);

  if (typeof doc.slug === "string") doc.slug = doc.slug.trim().toLowerCase();
  if (typeof doc.sku === "string") doc.sku = doc.sku.trim().toUpperCase();
  if (typeof doc.subjectCode === "string") doc.subjectCode = doc.subjectCode.trim().toUpperCase();
  if (typeof doc.lang3 === "string") doc.lang3 = doc.lang3.trim().toUpperCase();
  if (typeof doc.category === "string") doc.category = doc.category.trim();

  if (typeof doc.subjectTitleHi === "string") doc.subjectTitleHi = doc.subjectTitleHi.trim();
  if (typeof doc.subjectTitleEn === "string") doc.subjectTitleEn = doc.subjectTitleEn.trim();
  if (typeof doc.subjectTitleOther === "string") doc.subjectTitleOther = doc.subjectTitleOther.trim();

  doc.availability = normalizeAvailabilityValue(doc.availability);

  // backward compatibility: old field -> new field
  if (!String(doc.onDemandNote || "").trim() && String((doc as any).comingSoonNote || "").trim()) {
    doc.onDemandNote = String((doc as any).comingSoonNote || "").trim();
  }

  // category-driven product type safety
  doc.isDigital = deriveIsDigitalFromCategory(doc.category);

  // business safety: if pdfKey exists => always available
  if (String(doc.pdfKey || "").trim()) {
    doc.availability = "available";
  }

  if (doc.isAutoGenerated) {
    doc.autoGenerationType = safeStr(doc.autoGenerationType);
    doc.autoGeneratedFromSku = safeStr(doc.autoGeneratedFromSku).toUpperCase();
    doc.autoGeneratedFromCategory = safeStr(doc.autoGeneratedFromCategory);
    if (!doc.autoGeneratedAt) {
      doc.autoGeneratedAt = new Date();
    }
  } else {
    doc.autoGenerationType = "";
    doc.autoGeneratedFromProductId = null;
    doc.autoGeneratedFromSku = "";
    doc.autoGeneratedFromCategory = "";
    doc.autoGeneratedAt = null;
  }

  doc.lastModifiedAt = new Date();
});

/* =========================
   Compound indexes
   ========================= */
ProductSchema.index({ isActive: 1, deletedAt: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, deletedAt: 1, price: 1 });
ProductSchema.index({ isActive: 1, deletedAt: 1, price: -1 });
ProductSchema.index({ isActive: 1, deletedAt: 1, category: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, deletedAt: 1, session: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, deletedAt: 1, courseCodes: 1, createdAt: -1 });
ProductSchema.index({ deletedAt: 1, createdAt: -1 });
ProductSchema.index({ isAutoGenerated: 1, category: 1, deletedAt: 1, createdAt: -1 });
ProductSchema.index({ autoGenerationType: 1, autoGeneratedFromProductId: 1, deletedAt: 1 });
ProductSchema.index({ autoGenerationType: 1, autoGeneratedFromSku: 1, deletedAt: 1 });

/* =========================
   Text search index
   ========================= */
ProductSchema.index(
  {
    subjectCode: "text",
    title: "text",
    subjectTitleEn: "text",
    subjectTitleHi: "text",
    subjectTitleOther: "text",
    courseCodes: "text",
    courseTitles: "text",
    slug: "text",
    category: "text",
    session: "text",
    language: "text",
  },
  {
    name: "product_text_search_v3",
    weights: {
      subjectCode: 20,
      title: 12,
      courseCodes: 10,
      courseTitles: 8,
      subjectTitleEn: 7,
      subjectTitleHi: 6,
      subjectTitleOther: 6,
      slug: 5,
      category: 3,
      session: 2,
      language: 1,
    },
    default_language: "none",
    language_override: "textLang",
  }
);

export default models.Product || model("Product", ProductSchema);