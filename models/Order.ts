// models/Order.ts
import mongoose, { Schema, models, model } from "mongoose";

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    title: { type: String, default: "" },
    category: { type: String, default: "" },
    price: { type: Number, default: 0 },

    // ✅ Snapshot of private pdf key at purchase time (best for long-term access)
    pdfKey: { type: String, default: "" },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userEmail: { type: String, default: "", index: true },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },

    items: { type: [OrderItemSchema], default: [] },

    totalAmount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },

    paymentGateway: { type: String, default: "" }, // razorpay/stripe/etc
    paymentId: { type: String, default: "" },
    orderRef: { type: String, default: "", index: true }, // your internal order id

    paidAt: { type: Date, default: null },
    // ✅ access valid till (minimum 1 year)
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, status: 1, expiresAt: 1, createdAt: -1 });

export default models.Order || model("Order", OrderSchema);
