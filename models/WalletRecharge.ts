// models/WalletRecharge.ts
import mongoose, { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

const WalletRechargeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userEmail: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    planCode: {
      type: String,
      enum: ["basic", "standard", "premium"],
      required: true,
      index: true,
    },

    planName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    paymentGateway: {
      type: String,
      default: "razorpay",
      trim: true,
      index: true,
    },

    orderRef: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

WalletRechargeSchema.pre("save", function () {
  const doc = this as any;

  doc.userEmail = safeStr(doc.userEmail);
  doc.planName = safeStr(doc.planName);
  doc.currency = safeStr(doc.currency || "INR").toUpperCase();
  doc.paymentGateway = safeStr(doc.paymentGateway || "razorpay").toLowerCase();
  doc.orderRef = safeStr(doc.orderRef);
  doc.paymentId = safeStr(doc.paymentId);

  doc.amount = Math.max(0, safeNum(doc.amount, 0));

  const status = safeStr(doc.status).toLowerCase();
  doc.status = ["pending", "paid", "failed", "cancelled"].includes(status)
    ? status
    : "pending";

  const planCode = safeStr(doc.planCode).toLowerCase();
  doc.planCode = ["basic", "standard", "premium"].includes(planCode)
    ? planCode
    : "basic";
});

WalletRechargeSchema.index({ userId: 1, status: 1, createdAt: -1 });
WalletRechargeSchema.index({ orderRef: 1, status: 1 });
WalletRechargeSchema.index({ paymentId: 1, status: 1 });

export default models.WalletRecharge || model("WalletRecharge", WalletRechargeSchema);