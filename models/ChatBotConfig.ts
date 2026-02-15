import mongoose, { Schema, models, model } from "mongoose";

const ChatBotConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main", index: true },

    isEnabled: { type: Boolean, default: false, index: true },

    // Provider: WhatsApp (recommended), Tawk, Crisp, Custom embed script
    provider: {
      type: String,
      enum: ["whatsapp", "tawk", "crisp", "custom"],
      default: "whatsapp",
      index: true,
    },

    // Display controls
    showOnMobile: { type: Boolean, default: true },
    showOnDesktop: { type: Boolean, default: true },
    position: { type: String, enum: ["right", "left"], default: "right" },

    // WhatsApp
    whatsappNumber: { type: String, default: "" }, // e.g. 919876543210 (country code + number)
    whatsappMessage: { type: String, default: "Hi! I need help regarding IGNOU materials." },

    // Tawk.to
    tawkPropertyId: { type: String, default: "" },
    tawkWidgetId: { type: String, default: "" },

    // Crisp
    crispWebsiteId: { type: String, default: "" },

    // Custom script (embed)
    customScript: { type: String, default: "" },

    // UI Theme (optional)
    themeColor: { type: String, default: "#25D366" },

    lastModifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default models.ChatBotConfig || model("ChatBotConfig", ChatBotConfigSchema);
