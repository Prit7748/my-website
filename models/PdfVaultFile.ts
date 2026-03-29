import mongoose, { Schema, models, model } from "mongoose";

const PdfVaultFileSchema = new Schema(
  {
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "PdfVaultFolder",
      required: true,
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

    skuNormalized: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 60,
      index: true,
    },

    titleColor: {
      type: String,
      enum: ["green", "red"],
      default: "red",
      index: true,
    },

    productExists: {
      type: Boolean,
      default: false,
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

    movedAt: {
      type: Date,
      default: null,
    },

    movedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    replaceSourceFileId: {
      type: Schema.Types.ObjectId,
      ref: "PdfVaultFile",
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

PdfVaultFileSchema.index({ s3Key: 1 }, { unique: true });

PdfVaultFileSchema.index(
  { skuNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      skuNormalized: { $type: "string", $ne: "" },
      deletedAt: null,
    },
    name: "uniq_live_pdf_vault_sku",
  }
);

PdfVaultFileSchema.index({ folderId: 1, fileName: 1, deletedAt: 1 });
PdfVaultFileSchema.index({ folderId: 1, uploadedAt: -1 });
PdfVaultFileSchema.index({ folderId: 1, productExists: 1, uploadedAt: -1 });
PdfVaultFileSchema.index({ productId: 1, deletedAt: 1 });
PdfVaultFileSchema.index({ skuNormalized: 1, pageCount: 1, deletedAt: 1 });

export default models.PdfVaultFile || model("PdfVaultFile", PdfVaultFileSchema);