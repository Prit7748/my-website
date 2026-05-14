import mongoose, { Schema, models, model } from "mongoose";

function safeStr(input: any) {
  return String(input ?? "").trim();
}

function normalizeRating(input: any) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.trunc(n)));
}

const ProductReviewSchema = new Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    productSlug: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      index: true,
    },

    productTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 700,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    userEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 200,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },

    review: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },

    verifiedPurchase: {
      type: Boolean,
      default: false,
      index: true,
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    orderRef: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    purchasedAt: {
      type: Date,
      default: null,
      index: true,
    },

    purchaseCheckedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    approvedAt: {
      type: Date,
      default: null,
      index: true,
    },

    approvedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

ProductReviewSchema.pre("validate", function () {
  const doc = this as any;

  doc.productId = safeStr(doc.productId);
  doc.productSlug = safeStr(doc.productSlug);
  doc.productTitle = safeStr(doc.productTitle);

  doc.userName = safeStr(doc.userName);
  doc.userEmail = safeStr(doc.userEmail).toLowerCase();

  doc.rating = normalizeRating(doc.rating);
  doc.review = safeStr(doc.review);

  doc.verifiedPurchase = Boolean(doc.verifiedPurchase);
  doc.orderRef = safeStr(doc.orderRef);

  doc.adminNote = safeStr(doc.adminNote);
  doc.approvedBy = safeStr(doc.approvedBy);
  doc.rejectedBy = safeStr(doc.rejectedBy);

  const allowedStatus = new Set(["pending", "approved", "rejected"]);
  const status = safeStr(doc.status).toLowerCase();
  doc.status = allowedStatus.has(status) ? status : "pending";

  if (doc.status === "approved" && !doc.approvedAt) {
    doc.approvedAt = new Date();
  }

  if (doc.status !== "approved") {
    doc.approvedAt = null;
    doc.approvedBy = "";
  }

  if (doc.status === "rejected" && !doc.rejectedAt) {
    doc.rejectedAt = new Date();
  }

  if (doc.status !== "rejected") {
    doc.rejectedAt = null;
    doc.rejectedBy = "";
  }
});

ProductReviewSchema.index(
  { productId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
    },
    name: "uniq_live_product_review_by_user",
  }
);

ProductReviewSchema.index({
  productId: 1,
  status: 1,
  deletedAt: 1,
  createdAt: -1,
});

ProductReviewSchema.index({
  productId: 1,
  verifiedPurchase: 1,
  status: 1,
  createdAt: -1,
});

ProductReviewSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});

ProductReviewSchema.index({
  status: 1,
  createdAt: -1,
});

export default models.ProductReview ||
  model("ProductReview", ProductReviewSchema);