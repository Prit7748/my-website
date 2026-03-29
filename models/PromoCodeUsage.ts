import { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(x: any) {
  const n = safeNum(x, 0);
  return Math.round(n * 100) / 100;
}

const PromoCodeUsageSchema = new Schema(
  {
    promoCodeId: {
      type: Schema.Types.ObjectId,
      ref: "PromoCode",
      default: null,
      index: true,
    },

    // backward + forward compatibility
    promoCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
      maxlength: 40,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
      maxlength: 40,
    },

    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    userEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
      maxlength: 200,
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
      index: true,
      maxlength: 200,
    },

    orderStatus: {
      type: String,
      default: "pending",
      trim: true,
      index: true,
      maxlength: 40,
    },

    paymentGateway: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    appliedOnAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    originalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    payableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
      maxlength: 12,
    },

    itemsSnapshot: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },

    redeemedAt: {
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

PromoCodeUsageSchema.pre("save", function () {
  const doc = this as any;

  doc.code = safeStr(doc.code || doc.promoCode).toUpperCase();
  doc.promoCode = safeStr(doc.promoCode || doc.code).toUpperCase();
  doc.title = safeStr(doc.title);
  doc.userEmail = safeStr(doc.userEmail).toLowerCase();
  doc.orderRef = safeStr(doc.orderRef);
  doc.orderStatus = safeStr(doc.orderStatus || "pending").toLowerCase();
  doc.paymentGateway = safeStr(doc.paymentGateway);
  doc.paymentId = safeStr(doc.paymentId);
  doc.currency = safeStr(doc.currency || "INR").toUpperCase();

  const normalizedStatus = safeStr(doc.status || "pending").toLowerCase();
  doc.status = ["pending", "success", "failed", "cancelled"].includes(normalizedStatus)
    ? normalizedStatus
    : "pending";

  doc.discountAmount = roundMoney(Math.max(0, safeNum(doc.discountAmount, 0)));
  doc.appliedOnAmount = roundMoney(Math.max(0, safeNum(doc.appliedOnAmount, 0)));
  doc.originalAmount = roundMoney(Math.max(0, safeNum(doc.originalAmount, 0)));
  doc.payableAmount = roundMoney(Math.max(0, safeNum(doc.payableAmount, 0)));
  doc.totalAmount = roundMoney(Math.max(0, safeNum(doc.totalAmount, 0)));

  if (!Array.isArray(doc.itemsSnapshot)) {
    doc.itemsSnapshot = [];
  }

  if (doc.status === "success" && !doc.redeemedAt) {
    doc.redeemedAt = new Date();
  }

  if (doc.status !== "success" && doc.redeemedAt) {
    doc.redeemedAt = null;
  }
});

PromoCodeUsageSchema.index({ code: 1, createdAt: -1 });
PromoCodeUsageSchema.index({ promoCode: 1, createdAt: -1 });
PromoCodeUsageSchema.index({ userId: 1, createdAt: -1 });
PromoCodeUsageSchema.index({ userEmail: 1, createdAt: -1 });
PromoCodeUsageSchema.index({ orderId: 1, code: 1 });
PromoCodeUsageSchema.index({ orderRef: 1, code: 1 });
PromoCodeUsageSchema.index({ status: 1, createdAt: -1 });
PromoCodeUsageSchema.index({ orderStatus: 1, createdAt: -1 });

export default models.PromoCodeUsage || model("PromoCodeUsage", PromoCodeUsageSchema);