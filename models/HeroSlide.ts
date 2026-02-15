import mongoose, { Schema, models, model } from "mongoose";

const HeroSlideSchema = new Schema(
  {
    // desktop | mobile (2 categories as you said)
    device: {
      type: String,
      enum: ["desktop", "mobile"],
      required: true,
      index: true,
    },

    // image | video
    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
      index: true,
    },

    // URL or public path (/slider1.png, /intro.mp4, https://...)
    src: { type: String, required: true, trim: true },

    // Optional click link
    link: { type: String, default: "", trim: true },

    // For SEO/accessibility (image alt)
    alt: { type: String, default: "", trim: true },

    // Publish toggle
    isActive: { type: Boolean, default: true, index: true },

    // Sort order (ascending)
    order: { type: Number, default: 1000, index: true },

    // Track updates for cache busting / admin audit
    lastModifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

HeroSlideSchema.index({ device: 1, isActive: 1, order: 1, createdAt: -1 });

export default models.HeroSlide || model("HeroSlide", HeroSlideSchema);
