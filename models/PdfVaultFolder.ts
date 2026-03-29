import mongoose, { Schema, models, model } from "mongoose";

const PdfVaultFolderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "PdfVaultFolder",
      default: null,
      index: true,
    },

    path: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 2000,
    },

    level: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },

    isLocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    createdBy: {
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

PdfVaultFolderSchema.index({ parentId: 1, name: 1, deletedAt: 1 });
PdfVaultFolderSchema.index({ parentId: 1, slug: 1, deletedAt: 1 }, { unique: false });

export default models.PdfVaultFolder || model("PdfVaultFolder", PdfVaultFolderSchema);