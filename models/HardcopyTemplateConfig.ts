import { Schema, models, model } from "mongoose";

export const HARDCOPY_TEMPLATE_CONFIG_KEY = "hardcopy_templates_v1";

const HardcopyTemplateConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      default: HARDCOPY_TEMPLATE_CONFIG_KEY,
    },

    titleTemplate: {
      type: String,
      default: "IGNOU %1 Handwritten Hardcopy Assignment %5 (%6 Medium)",
      trim: true,
      maxlength: 500,
    },

    shortDescTemplate: {
      type: String,
      default:
        "Buy IGNOU %1 handwritten hardcopy assignment for session %5 in %6 medium. This is a physical handwritten delivery product.",
      trim: true,
      maxlength: 4000,
    },

    longDescTemplate: {
      type: String,
      default:
        "This product is the handwritten hardcopy delivery version of the solved assignment for subject %1 (%2). It is mapped to course %3 (%4), prepared for session %5, and available in %6 medium. This is a physical handwritten product, not a downloadable PDF.",
      trim: true,
      maxlength: 12000,
    },

    importantNoteTemplate: {
      type: String,
      default:
        "This product is a handwritten physical hardcopy delivery version of the related solved assignment. PDF is not included with this product. Please verify subject code, medium, session, and course before placing the order.",
      trim: true,
      maxlength: 8000,
    },

    metaTitleTemplate: {
      type: String,
      default: "IGNOU %1 Handwritten Hardcopy Assignment %5 (%6 Medium)",
      trim: true,
      maxlength: 300,
    },

    metaDescriptionTemplate: {
      type: String,
      default:
        "Order IGNOU %1 handwritten hardcopy assignment for session %5 in %6 medium. Physical delivery product based on the solved assignment source.",
      trim: true,
      maxlength: 1000,
    },

    deliveryChargeEnabled: {
      type: Boolean,
      default: true,
    },

    deliveryChargeThresholdAmount: {
      type: Number,
      default: 1000,
      min: 0,
    },

    deliveryChargeAmount: {
      type: Number,
      default: 100,
      min: 0,
    },

    deliveryChargeLabel: {
      type: String,
      default: "Delivery Charge",
      trim: true,
      maxlength: 120,
    },

    freeDeliveryLabel: {
      type: String,
      default: "Free Delivery",
      trim: true,
      maxlength: 120,
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

HardcopyTemplateConfigSchema.index({ key: 1 }, { unique: true });

export default models.HardcopyTemplateConfig ||
  model("HardcopyTemplateConfig", HardcopyTemplateConfigSchema);