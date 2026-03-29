import mongoose, { Schema, models, model } from "mongoose";

const ChatBotConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },

    isEnabled: { type: Boolean, default: false, index: true },

    provider: {
      type: String,
      enum: ["whatsapp", "tawk", "crisp", "custom"],
      default: "whatsapp",
      index: true,
    },

    showOnMobile: { type: Boolean, default: true },
    showOnDesktop: { type: Boolean, default: true },
    position: { type: String, enum: ["right", "left"], default: "right" },

    whatsappNumber: { type: String, default: "" },
    whatsappMessage: { type: String, default: "Hi! I need help regarding IGNOU materials." },

    tawkPropertyId: { type: String, default: "" },
    tawkWidgetId: { type: String, default: "" },

    crispWebsiteId: { type: String, default: "" },

    customScript: { type: String, default: "" },

    themeColor: { type: String, default: "#25D366" },

    lastModifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default models.ChatBotConfig || model("ChatBotConfig", ChatBotConfigSchema);