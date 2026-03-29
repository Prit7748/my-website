// models/WalletLedger.ts
import mongoose, { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

const WalletLedgerSchema = new Schema(
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

    entryType: {
      type: String,
      enum: [
        "recharge_credit",
        "wallet_debit",
        "manual_credit",
        "manual_debit",
        "refund_credit",
        "discount_access_use",
        "system_adjustment",
      ],
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["razorpay", "admin", "system", "order", "refund"],
      default: "system",
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "reversed"],
      default: "success",
      index: true,
    },

    direction: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceBefore: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },

    planCode: {
      type: String,
      enum: ["", "basic", "standard", "premium"],
      default: "",
      index: true,
    },

    planName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },

    productId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    orderId: {
      type: String,
      default: "",
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

    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

WalletLedgerSchema.pre("save", function () {
  const doc = this as any;

  doc.userEmail = safeStr(doc.userEmail);
  doc.planName = safeStr(doc.planName);
  doc.category = safeStr(doc.category);
  doc.productId = safeStr(doc.productId);
  doc.orderId = safeStr(doc.orderId);
  doc.orderRef = safeStr(doc.orderRef);
  doc.paymentId = safeStr(doc.paymentId);
  doc.note = safeStr(doc.note);

  doc.amount = Math.max(0, safeNum(doc.amount, 0));
  doc.balanceBefore = Math.max(0, safeNum(doc.balanceBefore, 0));
  doc.balanceAfter = Math.max(0, safeNum(doc.balanceAfter, 0));

  const direction = safeStr(doc.direction).toLowerCase();
  doc.direction = direction === "debit" ? "debit" : "credit";

  const status = safeStr(doc.status).toLowerCase();
  doc.status = ["pending", "success", "failed", "reversed"].includes(status)
    ? status
    : "success";

  const source = safeStr(doc.source).toLowerCase();
  doc.source = ["razorpay", "admin", "system", "order", "refund"].includes(source)
    ? source
    : "system";

  const entryType = safeStr(doc.entryType).toLowerCase();
  doc.entryType = [
    "recharge_credit",
    "wallet_debit",
    "manual_credit",
    "manual_debit",
    "refund_credit",
    "discount_access_use",
    "system_adjustment",
  ].includes(entryType)
    ? entryType
    : "system_adjustment";

  const planCode = safeStr(doc.planCode).toLowerCase();
  doc.planCode = ["", "basic", "standard", "premium"].includes(planCode)
    ? planCode
    : "";
});

WalletLedgerSchema.index({ userId: 1, createdAt: -1 });
WalletLedgerSchema.index({ userId: 1, status: 1, createdAt: -1 });
WalletLedgerSchema.index({ orderRef: 1, entryType: 1 });
WalletLedgerSchema.index({ paymentId: 1, entryType: 1 });

export default models.WalletLedger || model("WalletLedger", WalletLedgerSchema);