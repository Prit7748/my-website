// models/WantToBuy.ts  (NEW FILE)
import mongoose, { Schema, models, model } from "mongoose";

const WantToBuySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    userEmail: { type: String, default: "", index: true },

    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productSlug: { type: String, default: "", index: true },
    productTitle: { type: String, default: "" },
    category: { type: String, default: "" },
    price: { type: Number, default: 0 },

    message: { type: String, default: "" },
    phone: { type: String, default: "" },

    status: { type: String, enum: ["new", "contacted", "closed"], default: "new", index: true },
  },
  { timestamps: true }
);

WantToBuySchema.index({ productId: 1, userEmail: 1, createdAt: -1 });

export default models.WantToBuy || model("WantToBuy", WantToBuySchema);
