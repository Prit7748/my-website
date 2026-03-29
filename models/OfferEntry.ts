import mongoose, { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function cleanStringArray(arr: any) {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
}

const OfferEntrySchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
    },

    shortText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },

    badgeText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },

    couponCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
    },

    ctaText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    ctaHref: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    coverImageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    bgVariant: {
      type: String,
      enum: ["blue", "emerald", "violet", "amber", "rose", "slate"],
      default: "blue",
      index: true,
    },

    categoryTags: {
      type: [String],
      default: [],
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    startsAt: {
      type: Date,
      default: null,
      index: true,
    },

    endsAt: {
      type: Date,
      default: null,
      index: true,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

OfferEntrySchema.pre("save", function () {
  const doc = this as any;

  doc.title = safeStr(doc.title);
  doc.shortText = safeStr(doc.shortText);
  doc.badgeText = safeStr(doc.badgeText);
  doc.couponCode = safeStr(doc.couponCode).toUpperCase();
  doc.ctaText = safeStr(doc.ctaText);
  doc.ctaHref = safeStr(doc.ctaHref);
  doc.coverImageUrl = safeStr(doc.coverImageUrl);
  doc.updatedBy = safeStr(doc.updatedBy);
  doc.sortOrder = Math.trunc(safeNum(doc.sortOrder, 0));
  doc.categoryTags = cleanStringArray(doc.categoryTags);

  const allowedVariants = new Set(["blue", "emerald", "violet", "amber", "rose", "slate"]);
  const bg = safeStr(doc.bgVariant).toLowerCase();
  doc.bgVariant = allowedVariants.has(bg) ? bg : "blue";

  if (!doc.ctaHref && doc.couponCode) {
    doc.ctaHref = `/checkout?coupon=${encodeURIComponent(doc.couponCode)}`;
  }

  if (!doc.ctaText) {
    doc.ctaText = doc.couponCode ? "Use Offer" : "View Offer";
  }

  if (doc.startsAt && doc.endsAt && new Date(doc.startsAt).getTime() > new Date(doc.endsAt).getTime()) {
    const temp = doc.startsAt;
    doc.startsAt = doc.endsAt;
    doc.endsAt = temp;
  }
});

OfferEntrySchema.index({ isActive: 1, isFeatured: -1, sortOrder: 1, createdAt: -1 });
OfferEntrySchema.index({ startsAt: 1, endsAt: 1, isActive: 1 });
OfferEntrySchema.index({ couponCode: 1, isActive: 1 });

export default models.OfferEntry || model("OfferEntry", OfferEntrySchema);

