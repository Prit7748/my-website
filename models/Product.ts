import mongoose, { Schema, models, model } from "mongoose";

const ProductSchema = new Schema(
  {
    // Identity
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, required: true, unique: true, index: true }, // ✅ Unique ID pattern

    // Category (single)
    category: { type: String, required: true, index: true }, // e.g. "Solved Assignments"

    // Subject (single) + titles
    subjectCode: { type: String, required: true, index: true }, // e.g. BHIC 109
    subjectTitleHi: { type: String, default: "" },
    subjectTitleEn: { type: String, default: "" },

    // Course mapping (filters) - can be multiple
    courseCodes: { type: [String], default: [], index: true }, // e.g. ["BAHIH","BAG"]
    courseTitles: { type: [String], default: [] }, // optional same order

    // Session + Language
    session: { type: String, required: true, index: true }, // e.g. "2025-2026"
    session6: { type: String, required: true, index: true }, // e.g. "202526"
    language: { type: String, required: true, index: true }, // "Hindi"/"English"/"Other text"
    lang3: { type: String, required: true, index: true }, // "HIN"/"ENG"/"OTH"

    // Pricing
    price: { type: Number, required: true },
    oldPrice: { type: Number, default: 0 },

    // Extra fields
    pages: { type: Number, default: 0 },
    availability: {
      type: String,
      enum: ["available", "coming_soon", "out_of_stock"],
      default: "available",
      index: true,
    },
    importantNote: { type: String, default: "" },

    // Descriptions
    shortDesc: { type: String, default: "" },
    descriptionHtml: { type: String, default: "" },

    // Digital flags
    isDigital: { type: Boolean, default: true },
    pdfUrl: { type: String, default: "" },

    // Images system
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

export default models.Product || model("Product", ProductSchema);
