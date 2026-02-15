import mongoose, { Schema } from "mongoose";

const OptionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    nextId: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const NodeSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    options: { type: [OptionSchema], default: [] },
  },
  { _id: false }
);

const ChatBotFlowSchema = new Schema(
  {
    key: { type: String, unique: true, index: true, default: "main" },
    isActive: { type: Boolean, default: true },
    order: { type: [String], default: ["root"] },
    nodes: { type: Schema.Types.Mixed, default: {} }, // FlowMap
    lastModifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.ChatBotFlow || mongoose.model("ChatBotFlow", ChatBotFlowSchema);
