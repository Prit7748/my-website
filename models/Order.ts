import mongoose, { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function roundMoney(x: any) {
  const n = safeNum(x, 0);
  return Math.round(n * 100) / 100;
}

function uniqueStringArray(arr: any) {
  if (!Array.isArray(arr)) return [];

  return Array.from(
    new Set(
      arr
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
}

const ComboItemSnapshotSchema = new Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const OrderItemSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: ["product", "combo"],
      default: "product",
      index: true,
    },

    productId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    payableUnitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletDebitAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    payableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    pricingMode: {
      type: String,
      enum: ["regular", "discount_only", "wallet_deduction", "combo"],
      default: "regular",
    },

    resellerPlanCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },

    resellerPlanName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    pdfKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    comboSlug: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    comboCategorySlug: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    comboBadge: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    comboSaveLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    comboMediumLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    comboSessionLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },

    isBuilderCombo: {
      type: Boolean,
      default: false,
      index: true,
    },

    comboBuilderProductIds: {
      type: [String],
      default: [],
      index: true,
    },

    comboItems: {
      type: [ComboItemSnapshotSchema],
      default: [],
    },
  },
  { _id: false }
);

const ShiprocketSchema = new Schema(
  {
    status: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
      index: true,
    },
    orderId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    shipmentId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    awbCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    courierName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    courierCompanyId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    pickupLocation: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    error: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    requestPayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    responsePayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, default: "", index: true, trim: true },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },

    items: { type: [OrderItemSchema], default: [] },

    totalAmount: { type: Number, default: 0, min: 0 },
    originalAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    walletDebitAmount: { type: Number, default: 0, min: 0 },

    hardcopySubtotalAmount: { type: Number, default: 0, min: 0 },
    deliveryChargeAmount: { type: Number, default: 0, min: 0 },

    payableAmount: { type: Number, default: 0, min: 0 },

    currency: { type: String, default: "INR", trim: true },

    paymentGateway: { type: String, default: "", trim: true },
    paymentId: { type: String, default: "", trim: true },
    orderRef: { type: String, default: "", index: true, trim: true },

    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },

    coupon: { type: String, default: "", trim: true },
    customer: { type: Schema.Types.Mixed, default: null },
    shipping: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },

    shiprocket: {
      type: ShiprocketSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

OrderSchema.pre("save", function () {
  const doc = this as any;

  if (!Array.isArray(doc.items)) {
    doc.items = [];
  }

  doc.items = doc.items.map((item: any) => {
    const quantity = Math.max(1, Math.trunc(Number(item?.quantity || 1)));
    const originalPrice = roundMoney(item?.originalPrice || item?.price || 0);
    const discountedUnitPrice = roundMoney(item?.price || 0);

    const payableUnitPrice =
      item?.payableUnitPrice !== undefined && item?.payableUnitPrice !== null
        ? roundMoney(item?.payableUnitPrice)
        : discountedUnitPrice;

    const discountAmount =
      item?.discountAmount !== undefined && item?.discountAmount !== null
        ? roundMoney(item?.discountAmount)
        : roundMoney(Math.max(0, originalPrice - discountedUnitPrice) * quantity);

    const walletDebitAmount =
      item?.walletDebitAmount !== undefined && item?.walletDebitAmount !== null
        ? roundMoney(item?.walletDebitAmount)
        : 0;

    const payableAmount =
      item?.payableAmount !== undefined && item?.payableAmount !== null
        ? roundMoney(item?.payableAmount)
        : roundMoney(payableUnitPrice * quantity);

    const itemType =
      safeStr(item?.itemType || "product").toLowerCase() === "combo" ? "combo" : "product";

    const comboBuilderProductIds = uniqueStringArray(item?.comboBuilderProductIds);

    return {
      itemType,
      productId: safeStr(item?.productId),
      title: safeStr(item?.title),
      category: safeStr(item?.category),

      price: discountedUnitPrice,
      quantity,

      originalPrice,
      payableUnitPrice,
      discountPercent: Math.max(0, Math.min(100, safeNum(item?.discountPercent, 0))),
      discountAmount,
      walletDebitAmount,
      payableAmount,

      pricingMode: ["regular", "discount_only", "wallet_deduction", "combo"].includes(
        safeStr(item?.pricingMode).toLowerCase()
      )
        ? safeStr(item?.pricingMode).toLowerCase()
        : "regular",

      resellerPlanCode: safeStr(item?.resellerPlanCode).toLowerCase(),
      resellerPlanName: safeStr(item?.resellerPlanName),

      pdfKey: safeStr(item?.pdfKey),

      comboSlug: safeStr(item?.comboSlug),
      comboCategorySlug: safeStr(item?.comboCategorySlug),
      comboBadge: safeStr(item?.comboBadge),
      comboSaveLabel: safeStr(item?.comboSaveLabel),
      comboMediumLabel: safeStr(item?.comboMediumLabel),
      comboSessionLabel: safeStr(item?.comboSessionLabel),

      isBuilderCombo: Boolean(item?.isBuilderCombo) || comboBuilderProductIds.length > 0,
      comboBuilderProductIds,

      comboItems: Array.isArray(item?.comboItems)
        ? item.comboItems
            .map((x: any) => ({
              title: safeStr(x?.title),
              subtitle: safeStr(x?.subtitle),
            }))
            .filter((x: any) => x.title)
        : [],
    };
  });

  doc.userEmail = safeStr(doc.userEmail);
  doc.paymentGateway = safeStr(doc.paymentGateway);
  doc.paymentId = safeStr(doc.paymentId);
  doc.orderRef = safeStr(doc.orderRef);
  doc.coupon = safeStr(doc.coupon);

  doc.originalAmount = roundMoney(
    doc.items.reduce((acc: number, item: any) => {
      return acc + roundMoney(item.originalPrice || 0) * Math.max(1, Number(item.quantity || 1));
    }, 0)
  );

  doc.discountAmount = roundMoney(
    doc.items.reduce((acc: number, item: any) => {
      return acc + roundMoney(item.discountAmount || 0);
    }, 0)
  );

  doc.walletDebitAmount = roundMoney(
    doc.items.reduce((acc: number, item: any) => {
      return acc + roundMoney(item.walletDebitAmount || 0);
    }, 0)
  );

  const itemsPayableAmount = roundMoney(
    doc.items.reduce((acc: number, item: any) => {
      if (item.payableAmount !== undefined && item.payableAmount !== null) {
        return acc + roundMoney(item.payableAmount || 0);
      }

      return acc + roundMoney(item.price || 0) * Math.max(1, Number(item.quantity || 1));
    }, 0)
  );

  doc.hardcopySubtotalAmount = roundMoney(doc.hardcopySubtotalAmount || 0);
  doc.deliveryChargeAmount = roundMoney(doc.deliveryChargeAmount || 0);

  doc.payableAmount = roundMoney(itemsPayableAmount + doc.deliveryChargeAmount);
  doc.totalAmount = doc.payableAmount;

  if (!doc.shiprocket || typeof doc.shiprocket !== "object") {
    doc.shiprocket = {};
  }

  doc.shiprocket.status = safeStr(doc.shiprocket.status);
  doc.shiprocket.orderId = safeStr(doc.shiprocket.orderId);
  doc.shiprocket.shipmentId = safeStr(doc.shiprocket.shipmentId);
  doc.shiprocket.awbCode = safeStr(doc.shiprocket.awbCode);
  doc.shiprocket.courierName = safeStr(doc.shiprocket.courierName);
  doc.shiprocket.courierCompanyId = safeStr(doc.shiprocket.courierCompanyId);
  doc.shiprocket.pickupLocation = safeStr(doc.shiprocket.pickupLocation);
  doc.shiprocket.error = safeStr(doc.shiprocket.error);
});

OrderSchema.index({ userId: 1, status: 1, expiresAt: 1, createdAt: -1 });
OrderSchema.index({ orderRef: 1, status: 1 });
OrderSchema.index({ "items.itemType": 1, createdAt: -1 });
OrderSchema.index({ "items.isBuilderCombo": 1, createdAt: -1 });
OrderSchema.index({ "items.comboBuilderProductIds": 1, createdAt: -1 });
OrderSchema.index({ "shiprocket.status": 1, createdAt: -1 });
OrderSchema.index({ "shiprocket.shipmentId": 1 });
OrderSchema.index({ "shiprocket.orderId": 1 });
OrderSchema.index({ "shiprocket.awbCode": 1 });

export default models.Order || model("Order", OrderSchema);