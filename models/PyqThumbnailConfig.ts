import { Schema, models, model } from "mongoose";

export const PYQ_THUMBNAIL_CONFIG_KEY = "pyq_thumbnail_config_v1";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

const PyqThumbnailConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: PYQ_THUMBNAIL_CONFIG_KEY,
      index: true,
    },

    isEnabled: {
      type: Boolean,
      default: true,
    },

    templateImageUrl: {
      type: String,
      default: "/images/thumbs/pyq-master-template.png",
      trim: true,
      maxlength: 3000,
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

PyqThumbnailConfigSchema.pre("save", function () {
  const doc = this as any;

  doc.key = safeStr(doc.key || PYQ_THUMBNAIL_CONFIG_KEY) || PYQ_THUMBNAIL_CONFIG_KEY;
  doc.templateImageUrl = safeStr(doc.templateImageUrl);
  doc.updatedBy = safeStr(doc.updatedBy);
  doc.isEnabled = Boolean(doc.isEnabled);
});

export default models.PyqThumbnailConfig ||
  model("PyqThumbnailConfig", PyqThumbnailConfigSchema);