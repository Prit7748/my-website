import mongoose, { Schema, models, model } from "mongoose";

const ProductSchema = new Schema(
  {
    // Identity
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, required: true, unique: true, index: true },

    // Category
    category: { type: String, required: true, index: true },

    // Subject
    subjectCode: { type: String, required: true, index: true },
    subjectTitleHi: { type: String, default: "" },
    subjectTitleEn: { type: String, default: "" },

    // Course
    courseCodes: { type: [String], default: [], index: true },
    courseTitles: { type: [String], default: [] },

    // Session + Language
    session: { type: String, required: true, index: true },
    session6: { type: String, required: true, index: true },
    language: { type: String, required: true, index: true },
    lang3: { type: String, required: true, index: true },

    // Pricing
    price: { type: Number, required: true },
    oldPrice: { type: Number, default: 0 },

    // Extra
    pages: { type: Number, default: 0 },
    availability: {
      type: String,
      enum: ["available", "coming_soon", "out_of_stock"],
      default: "available",
      index: true,
    },
    importantNote: { type: String, default: "" },

    // Description
    shortDesc: { type: String, default: "" },
    descriptionHtml: { type: String, default: "" },

    // Digital
    isDigital: { type: Boolean, default: true },
    pdfUrl: { type: String, default: "" },

    // Images
    images: { type: [String], default: [] },
    thumbnailUrl: { type: String, default: "" },
    quickUrl: { type: String, default: "" },

    // SEO
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },

    // Publish
    isActive: { type: Boolean, default: false, index: true },
    lastModifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* ===== COMPOUND INDEXES ===== */
ProductSchema.index({ isActive: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, price: 1 });
ProductSchema.index({ isActive: 1, price: -1 });
ProductSchema.index({ isActive: 1, category: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, session: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, courseCodes: 1, createdAt: -1 });

/* ===== TEXT SEARCH INDEX ===== */
ProductSchema.index(
  {
    subjectCode: "text",
    title: "text",
    subjectTitleEn: "text",
    subjectTitleHi: "text",
    courseCodes: "text",
    courseTitles: "text",
    slug: "text",
    category: "text",
    session: "text",
    language: "text",
  },
  {
    name: "product_text_search_v2",
    weights: {
      subjectCode: 20,
      title: 12,
      courseCodes: 10,
      courseTitles: 8,
      subjectTitleEn: 7,
      subjectTitleHi: 6,
      slug: 5,
      category: 3,
      session: 2,
      language: 1,
    },
    default_language: "none",
  }
);

export default models.Product || model("Product", ProductSchema);
