import { Schema, models, model } from "mongoose";

const HeroSlideSchema = new Schema(
  {
    device: {
      type: String,
      enum: ["desktop", "mobile"],
      required: true,
      default: "desktop",
      trim: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
      default: "image",
      trim: true,
      index: true,
    },

    // Public path or full URL
    src: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Optional click URL/path
    link: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    // Accessibility / SEO text
    alt: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    order: {
      type: Number,
      default: 1000,
      min: 0,
      max: 999999,
      index: true,
    },

    // Per-slide stay duration in seconds
    durationSeconds: {
      type: Number,
      default: 5,
      min: 1,
      max: 60,
      index: true,
    },

    lastModifiedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

HeroSlideSchema.index({
  device: 1,
  isActive: 1,
  order: 1,
  createdAt: -1,
  _id: 1,
});

const HeroSlide = models.HeroSlide || model("HeroSlide", HeroSlideSchema);

export default HeroSlide;