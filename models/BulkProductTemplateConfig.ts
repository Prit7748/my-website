import { Schema, models, model } from "mongoose";

export const BULK_PRODUCT_TEMPLATE_CONFIG_KEY = "bulk_product_details_templates_v1";

const BulkProductTemplateItemSchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    titleTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    importantNoteTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 8000,
    },

    shortDescTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },

    longDescTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 12000,
    },

    slugTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    metaTitleTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    metaDescriptionTemplate: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    publishNow: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const BulkProductTemplateConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: BULK_PRODUCT_TEMPLATE_CONFIG_KEY,
    },

    items: {
      type: [BulkProductTemplateItemSchema],
      default: [],
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: true }
);

export default models.BulkProductTemplateConfig ||
  model("BulkProductTemplateConfig", BulkProductTemplateConfigSchema);