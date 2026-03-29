import { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

const OfficialPaperSchema = new Schema(
  {
    skuNormalized: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
      index: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    productSku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 60,
      index: true,
    },

    productSlug: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    productExists: {
      type: Boolean,
      default: false,
      index: true,
    },

    titleColor: {
      type: String,
      enum: ["green", "red"],
      default: "red",
      index: true,
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      index: true,
    },

    fileExt: {
      type: String,
      default: ".pdf",
      trim: true,
      maxlength: 20,
    },

    baseName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      index: true,
    },

    mimeType: {
      type: String,
      default: "application/pdf",
      trim: true,
      maxlength: 120,
    },

    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },

    pageCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    sha256: {
      type: String,
      default: "",
      trim: true,
      maxlength: 128,
      index: true,
    },

    s3Bucket: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    s3Key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
      unique: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    uploadedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    replaceSourceFileId: {
      type: Schema.Types.ObjectId,
      ref: "OfficialPaper",
      default: null,
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

OfficialPaperSchema.pre("save", function () {
  const doc = this as any;

  doc.skuNormalized = safeStr(doc.skuNormalized).toUpperCase();
  doc.productSku = safeStr(doc.productSku).toUpperCase();
  doc.productSlug = safeStr(doc.productSlug);
  doc.originalName = safeStr(doc.originalName);
  doc.fileName = safeStr(doc.fileName);
  doc.fileExt = safeStr(doc.fileExt || ".pdf").toLowerCase();
  doc.baseName = safeStr(doc.baseName);
  doc.mimeType = safeStr(doc.mimeType || "application/pdf");
  doc.sha256 = safeStr(doc.sha256);
  doc.s3Bucket = safeStr(doc.s3Bucket);
  doc.s3Key = safeStr(doc.s3Key);
  doc.uploadedBy = safeStr(doc.uploadedBy);
  doc.updatedBy = safeStr(doc.updatedBy);

  doc.sizeBytes = Math.max(0, Math.trunc(Number(doc.sizeBytes || 0)));
  doc.pageCount = Math.max(0, Math.trunc(Number(doc.pageCount || 0)));

  const productExists = Boolean(doc.productId) || Boolean(safeStr(doc.productSku));
  doc.productExists = productExists;
  doc.titleColor = productExists ? "green" : "red";
});

OfficialPaperSchema.index(
  { skuNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      skuNormalized: { $type: "string", $ne: "" },
      deletedAt: null,
    },
    name: "uniq_live_official_paper_sku",
  }
);

OfficialPaperSchema.index({ productId: 1, deletedAt: 1 });
OfficialPaperSchema.index({ skuNormalized: 1, deletedAt: 1, uploadedAt: -1 });
OfficialPaperSchema.index({ productExists: 1, deletedAt: 1, uploadedAt: -1 });
OfficialPaperSchema.index({ deletedAt: 1, uploadedAt: -1 });

export default models.OfficialPaper || model("OfficialPaper", OfficialPaperSchema);