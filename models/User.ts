// models/User.ts
import mongoose, { Schema } from "mongoose";

function normPhone(input: any) {
  const s = String(input ?? "").trim();
  return s.replace(/[^\d+]/g, "");
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

const ResellerSchema = new Schema(
  {
    isReseller: {
      type: Boolean,
      default: false,
      index: true,
    },

    status: {
      type: String,
      enum: ["inactive", "active", "paused", "blocked"],
      default: "inactive",
      index: true,
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

    planActivatedAt: {
      type: Date,
      default: null,
    },

    lastRechargeAt: {
      type: Date,
      default: null,
    },

    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletTotalRecharged: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletTotalUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletTotalDiscountSaved: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountUsageByCategory: {
      type: Map,
      of: Number,
      default: {},
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, trim: true, default: "" },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      set: normPhone,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "co_admin", "master_admin"],
      default: "user",
    },

    adminKeyHash: {
      type: String,
      default: null,
    },

    permissions: {
      type: [String],
      default: [],
    },

    masterOtpHash: {
      type: String,
      default: null,
    },

    masterOtpExpiresAt: {
      type: Date,
      default: null,
    },

    reseller: {
      type: ResellerSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", function () {
  const doc = this as any;

  if (!doc.reseller || typeof doc.reseller !== "object") {
    doc.reseller = {};
  }

  doc.reseller.isReseller = Boolean(doc.reseller.isReseller);

  const allowedStatus = new Set(["inactive", "active", "paused", "blocked"]);
  const allowedPlanCodes = new Set(["", "basic", "standard", "premium"]);

  const status = String(doc.reseller.status ?? "inactive").trim().toLowerCase();
  const planCode = String(doc.reseller.planCode ?? "").trim().toLowerCase();

  doc.reseller.status = allowedStatus.has(status) ? status : "inactive";
  doc.reseller.planCode = allowedPlanCodes.has(planCode) ? planCode : "";

  doc.reseller.planName = String(doc.reseller.planName ?? "").trim();

  doc.reseller.walletBalance = Math.max(0, safeNum(doc.reseller.walletBalance, 0));
  doc.reseller.walletTotalRecharged = Math.max(0, safeNum(doc.reseller.walletTotalRecharged, 0));
  doc.reseller.walletTotalUsed = Math.max(0, safeNum(doc.reseller.walletTotalUsed, 0));
  doc.reseller.walletTotalDiscountSaved = Math.max(0, safeNum(doc.reseller.walletTotalDiscountSaved, 0));

  if (
    doc.reseller.discountUsageByCategory &&
    typeof doc.reseller.discountUsageByCategory === "object"
  ) {
    const cleaned: Record<string, number> = {};
    const raw =
      typeof doc.reseller.discountUsageByCategory.toObject === "function"
        ? doc.reseller.discountUsageByCategory.toObject()
        : doc.reseller.discountUsageByCategory;

    for (const [key, value] of Object.entries(raw || {})) {
      const k = String(key ?? "").trim();
      if (!k) continue;
      cleaned[k] = Math.max(0, safeNum(value, 0));
    }

    doc.reseller.discountUsageByCategory = cleaned;
  } else {
    doc.reseller.discountUsageByCategory = {};
  }

  doc.reseller.notes = String(doc.reseller.notes ?? "").trim();

  if (!doc.reseller.isReseller) {
    doc.reseller.status = "inactive";
    doc.reseller.planCode = "";
    doc.reseller.planName = "";
  }
});

UserSchema.index({ "reseller.isReseller": 1, "reseller.status": 1, createdAt: -1 });
UserSchema.index({ "reseller.planCode": 1, createdAt: -1 });

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;