import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ChatBotFlow from "@/models/ChatBotFlow";
import { requireAdmin } from "@/lib/adminAuth";

function now() {
  return new Date();
}
function safeStr(x: any) {
  return String(x || "").trim();
}
function safeBool(x: any) {
  return x === true || x === "true" || x === 1 || x === "1";
}

type FlowNode = { text: string; options: { label: string; nextId: string }[] };
type FlowMap = Record<string, FlowNode>;

// ✅ Default flow (seed)
const DEFAULT_FLOW: FlowMap = {
  root: {
    text: "Hi! I am Navi 🤖. How can I help you today?",
    options: [
      { label: "IGNOU Assignments", nextId: "assignments" },
      { label: "Exam Updates", nextId: "exams" },
      { label: "Download Papers", nextId: "papers" },
      { label: "Contact Support", nextId: "contact" },
    ],
  },
  assignments: {
    text: "Please select your course type for Assignments:",
    options: [
      { label: "Master's Degree (MA/M.Com)", nextId: "masters" },
      { label: "Bachelor's Degree (BA/B.Com)", nextId: "bachelors" },
      { label: "Diploma / Certificate", nextId: "diploma" },
      { label: "Go to Main Menu", nextId: "root" },
    ],
  },
  masters: {
    text: "Great! Which specific subject do you need?",
    options: [
      { label: "M.Com (Commerce)", nextId: "final_msg" },
      { label: "MA English (MEG)", nextId: "final_msg" },
      { label: "MA Hindi (MHD)", nextId: "final_msg" },
      { label: "MA History (MAH)", nextId: "final_msg" },
      { label: "Back", nextId: "assignments" },
    ],
  },
  bachelors: {
    text: "Select your Bachelor's requirement:",
    options: [
      { label: "BA (General)", nextId: "final_msg" },
      { label: "B.Com", nextId: "final_msg" },
      { label: "B.Ed", nextId: "final_msg" },
      { label: "Back", nextId: "assignments" },
    ],
  },
  diploma: {
    text: "Select your Diploma/Certificate requirement:",
    options: [
      { label: "Diploma Assignments", nextId: "final_msg" },
      { label: "Certificate Assignments", nextId: "final_msg" },
      { label: "Back", nextId: "assignments" },
    ],
  },
  exams: {
    text: "What information do you need regarding Exams?",
    options: [
      { label: "Date Sheet", nextId: "final_msg" },
      { label: "Hall Ticket Download", nextId: "final_msg" },
      { label: "Result Updates", nextId: "final_msg" },
      { label: "Go to Blog Updates", nextId: "open:/blog" },
      { label: "Go to Main Menu", nextId: "root" },
    ],
  },
  papers: {
    text: "Which papers do you need?",
    options: [
      { label: "Previous Year Question Papers (PYQ)", nextId: "open:/question-papers" },
      { label: "Guess Papers", nextId: "open:/guess-papers" },
      { label: "Go to Main Menu", nextId: "root" },
    ],
  },
  contact: {
    text: "Choose support option:",
    options: [
      { label: "Open WhatsApp", nextId: "whatsapp_action" },
      { label: "Contact Page", nextId: "open:/contact" },
      { label: "Go to Main Menu", nextId: "root" },
    ],
  },
  final_msg: {
    text: "Thank you! Please visit our 'Shop' section or WhatsApp us for this specific requirement. Should I connect you to WhatsApp?",
    options: [
      { label: "Yes, Open WhatsApp", nextId: "whatsapp_action" },
      { label: "No, Go to Main Menu", nextId: "root" },
    ],
  },
};

function buildDefaultOrder(nodes: FlowMap) {
  const keys = Object.keys(nodes || {});
  if (!keys.length) return ["root"];
  if (keys.includes("root")) return ["root", ...keys.filter((k) => k !== "root")];
  return keys;
}

function sanitizeFlow(raw: any): FlowMap {
  const out: FlowMap = {};
  if (!raw || typeof raw !== "object") return DEFAULT_FLOW;

  for (const k of Object.keys(raw)) {
    const id = safeStr(k);
    if (!id) continue;

    const node = raw[k];
    const text = safeStr(node?.text);

    const optionsRaw = Array.isArray(node?.options) ? node.options : [];
    const options = optionsRaw
      .map((o: any) => ({ label: safeStr(o?.label), nextId: safeStr(o?.nextId) }))
      .filter((o: any) => o.label && o.nextId)
      .slice(0, 12);

    if (!text || !options.length) continue;
    out[id] = { text, options };
  }

  // must have root
  if (!out.root) return DEFAULT_FLOW;
  return out;
}

function sanitizeOrder(rawOrder: any, nodes: FlowMap): string[] {
  const keys = new Set(Object.keys(nodes || {}));
  const orderArr = Array.isArray(rawOrder) ? rawOrder.map(safeStr).filter(Boolean) : [];

  // keep only existing nodes
  let cleaned = orderArr.filter((id) => keys.has(id));

  // if empty → auto build
  if (!cleaned.length) cleaned = buildDefaultOrder(nodes);

  // ensure root at first
  if (!cleaned.includes("root")) cleaned.unshift("root");
  if (cleaned[0] !== "root") {
    cleaned = ["root", ...cleaned.filter((x) => x !== "root")];
  }

  // ensure all nodes included (append missing)
  for (const id of keys) {
    if (!cleaned.includes(id)) cleaned.push(id);
  }

  return cleaned;
}

export async function GET() {
  await dbConnect();

  let doc: any = await ChatBotFlow.findOne({ key: "main" }).lean();

  const nodesEmpty =
    !doc || !doc.nodes || typeof doc.nodes !== "object" || Object.keys(doc.nodes).length === 0;

  // ✅ seed if missing
  if (nodesEmpty) {
    doc = await ChatBotFlow.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          isActive: true,
          nodes: DEFAULT_FLOW,
          order: buildDefaultOrder(DEFAULT_FLOW),
          lastModifiedAt: now(),
        },
        $setOnInsert: { key: "main" },
      },
      { upsert: true, new: true }
    ).lean();
  }

  const nodes: FlowMap = doc.nodes || DEFAULT_FLOW;
  const order = sanitizeOrder(doc.order, nodes);

  // ✅ keep DB consistent if order missing/broken
  if (!Array.isArray(doc.order) || JSON.stringify(doc.order) !== JSON.stringify(order)) {
    await ChatBotFlow.findOneAndUpdate(
      { key: "main" },
      { $set: { order, lastModifiedAt: now() } },
      { upsert: true }
    );
  }

  return NextResponse.json(
    {
      key: "main",
      isActive: doc.isActive !== false,
      nodes,
      order,
      lastModifiedAt: doc.lastModifiedAt || doc.updatedAt || null,
    },
    { status: 200 }
  );
}

// ✅ ADMIN SAVE
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(); // ✅ your requireAdmin is 0-arg
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const body = await req.json().catch(() => ({}));

  const isActive = safeBool(body?.isActive); // ✅ proper boolean
  const nodes = sanitizeFlow(body?.nodes);
  const order = sanitizeOrder(body?.order, nodes);

  const doc = await ChatBotFlow.findOneAndUpdate(
    { key: "main" },
    { $set: { isActive, nodes, order, lastModifiedAt: now() }, $setOnInsert: { key: "main" } },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ ok: true, flow: doc }, { status: 200 });
}
