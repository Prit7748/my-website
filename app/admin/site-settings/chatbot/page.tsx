"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Bot,
    Plus,
    Save,
    Trash2,
    Eye,
    GripVertical,
    RefreshCcw,
    Power,
} from "lucide-react";

type Option = { label: string; nextId: string };
type Node = { text: string; options: Option[] };
type FlowMap = Record<string, Node>;

type ChatBotConfig = {
    isEnabled: boolean; // ✅ ONLINE/OFFLINE for website
    showOnMobile: boolean;
    showOnDesktop: boolean;
    position: "right" | "left";
    whatsappNumber: string;
    whatsappMessage: string;
    themeColor: string;
    provider: "whatsapp" | "tawk" | "crisp" | "custom";
};

function safeStr(x: any) {
    return String(x || "").trim();
}

function uid(prefix = "step") {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now()
        .toString(36)
        .slice(4)}`;
}

/* =========================
   FLOW API
   ========================= */
async function fetchFlow(): Promise<{ isActive: boolean; nodes: FlowMap; order: string[] } | null> {
    try {
        const res = await fetch("/api/site-settings/chatbot-flow", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return { isActive: data?.isActive !== false, nodes: data?.nodes || {}, order: Array.isArray(data?.order) ? data.order : [] };
    } catch {
        return null;
    }
}

async function saveFlow(payload: { isActive: boolean; nodes: FlowMap; order: string[] }) {
    const res = await fetch("/api/site-settings/chatbot-flow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Save failed");
    return res.json();
}

/* =========================
   CONFIG API (ONLINE/OFFLINE)
   ========================= */
async function fetchConfig(): Promise<ChatBotConfig | null> {
    try {
        const res = await fetch("/api/site-settings/chatbot", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            isEnabled: !!data.isEnabled,
            showOnMobile: data.showOnMobile !== false,
            showOnDesktop: data.showOnDesktop !== false,
            position: data.position === "left" ? "left" : "right",
            whatsappNumber: String(data.whatsappNumber || ""),
            whatsappMessage: String(data.whatsappMessage || ""),
            themeColor: String(data.themeColor || "#3B82F6"),
            provider: (data.provider || "whatsapp") as any,
        };
    } catch {
        return null;
    }
}

async function saveConfig(patch: Partial<ChatBotConfig>) {
    const res = await fetch("/api/site-settings/chatbot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Save config failed");
    return res.json();
}

export default function ChatBotFlowEditorPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ✅ Website Online/Offline config state
    const [cfgLoading, setCfgLoading] = useState(true);
    const [cfgSaving, setCfgSaving] = useState(false);
    const [botOnline, setBotOnline] = useState<boolean>(true);

    // Flow editor state
    const [isActive, setIsActive] = useState(true);
    const [nodes, setNodes] = useState<FlowMap>({});
    const [order, setOrder] = useState<string[]>([]);
    const [selected, setSelected] = useState<string>("root");
    const [mode, setMode] = useState<"edit" | "preview">("edit");

    // preview state
    const [previewStep, setPreviewStep] = useState("root");
    const [previewHistory, setPreviewHistory] = useState<string[]>([]);

    // ✅ first load: config + flow
    useEffect(() => {
        (async () => {
            setLoading(true);
            setCfgLoading(true);

            const [flowData, cfgData] = await Promise.all([fetchFlow(), fetchConfig()]);

            if (cfgData) {
                setBotOnline(!!cfgData.isEnabled);
            }
            setCfgLoading(false);

            if (flowData?.nodes && Object.keys(flowData.nodes).length) {
                setIsActive(flowData.isActive);
                setNodes(flowData.nodes);
                const keys = Object.keys(flowData.nodes);
                const sorted = keys.includes("root")
                    ? ["root", ...keys.filter((k) => k !== "root").sort()]
                    : keys.sort();
                setOrder(sorted);
                setSelected(sorted[0] || "root");
            }

            setLoading(false);
        })();
    }, []);

    const selectedNode = nodes[selected];
    const allStepIds = useMemo(() => new Set(Object.keys(nodes)), [nodes]);

    function addStep() {
        const id = uid("step");
        const nextNodes: FlowMap = {
            ...nodes,
            [id]: {
                text: "New step text...",
                options: [{ label: "Go to Main Menu", nextId: "root" }],
            },
        };
        setNodes(nextNodes);
        setOrder((o) => [...o, id]);
        setSelected(id);
    }

    function deleteStep(id: string) {
        if (id === "root") return;
        const next = { ...nodes };
        delete next[id];
        setNodes(next);
        setOrder((o) => o.filter((x) => x !== id));
        setSelected("root");
    }

    function updateStepText(val: string) {
        setNodes((prev) => ({
            ...prev,
            [selected]: { ...prev[selected], text: val },
        }));
    }

    function updateOption(idx: number, patch: Partial<Option>) {
        setNodes((prev) => {
            const node = prev[selected];
            const options = [...(node?.options || [])];
            options[idx] = { ...options[idx], ...patch };
            return { ...prev, [selected]: { ...node, options } };
        });
    }

    function addOption() {
        setNodes((prev) => {
            const node = prev[selected];
            const options = [...(node?.options || []), { label: "New option", nextId: "root" }];
            return { ...prev, [selected]: { ...node, options } };
        });
    }

    function removeOption(idx: number) {
        setNodes((prev) => {
            const node = prev[selected];
            const options = [...(node?.options || [])].filter((_, i) => i !== idx);
            return { ...prev, [selected]: { ...node, options } };
        });
    }

    function moveStep(id: string, dir: -1 | 1) {
        setOrder((o) => {
            const i = o.indexOf(id);
            if (i < 0) return o;
            const j = i + dir;
            if (j < 0 || j >= o.length) return o;
            const copy = [...o];
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
            return copy;
        });
    }

    async function onSave() {
        setSaving(true);
        try {
            const cleaned: FlowMap = {};
            for (const id of order) {
                const n = nodes[id];
                if (!n?.text || !Array.isArray(n.options) || !n.options.length) continue;
                cleaned[id] = {
                    text: safeStr(n.text),
                    options: n.options
                        .map((o) => ({ label: safeStr(o.label), nextId: safeStr(o.nextId) }))
                        .filter((o) => o.label && o.nextId),
                };
            }
            if (!cleaned.root) throw new Error("Root step missing");

            await saveFlow({ isActive, nodes: cleaned, order });

            setNodes(cleaned);
            setOrder(
                Object.keys(cleaned).includes("root")
                    ? ["root", ...Object.keys(cleaned).filter((k) => k !== "root")]
                    : Object.keys(cleaned)
            );
            alert("Saved ✅");
        } catch {
            alert("Save failed. Please ensure every step has text + at least 1 option, and root exists.");
        } finally {
            setSaving(false);
        }
    }

    async function toggleOnline(next: boolean) {
        setCfgSaving(true);
        try {
            setBotOnline(next);
            await saveConfig({ isEnabled: next });
        } catch {
            alert("Failed to update online/offline status.");
            setBotOnline((v) => !v);
        } finally {
            setCfgSaving(false);
        }
    }

    function previewClick(nextId: string) {
        if (nextId === "whatsapp_action") {
            alert("This will open WhatsApp on real site. (Preview blocked)");
            return;
        }
        if (nextId.startsWith("open:")) {
            alert(`This will open: ${nextId.replace("open:", "")} (Preview blocked)`);
            return;
        }
        if (!nodes[nextId]) {
            alert(`Step not found: "${nextId}"`);
            return;
        }
        setPreviewHistory((h) => [...h, previewStep]);
        setPreviewStep(nextId);
    }

    function previewBack() {
        setPreviewHistory((h) => {
            if (!h.length) return h;
            const prev = h[h.length - 1];
            setPreviewStep(prev);
            return h.slice(0, -1);
        });
    }

    function previewReset() {
        setPreviewStep("root");
        setPreviewHistory([]);
    }

    const previewNode = nodes[previewStep] || nodes["root"];

    return (
        <main className="min-h-screen bg-gray-100 text-slate-900">
            <div className="max-w-6xl mx-auto px-4 py-10">
                <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-2xl font-extrabold flex items-center gap-2">
                                <Bot className="text-slate-700" />
                                ChatBot Flow Editor
                            </div>
                            <div className="text-sm text-slate-600 mt-1">
                                Manage steps (layers), options, order & preview
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link
                                href="/admin/site-settings"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
                            >
                                <ArrowLeft size={18} /> Back
                            </Link>

                            <button
                                onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white transition font-bold shadow-sm"
                            >
                                <Eye size={18} /> {mode === "edit" ? "Preview" : "Edit"}
                            </button>
                        </div>
                    </div>

                    {/* ✅ ONLINE / OFFLINE SECTION */}
                    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <Power size={16} /> Chatbot on Website
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                                This controls if the chatbot button is visible on your website (Online/Offline).
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {cfgLoading ? (
                                <div className="text-xs font-bold text-slate-500">Loading...</div>
                            ) : (
                                <>
                                    <div
                                        className={`text-xs font-extrabold px-3 py-1 rounded-full ${botOnline ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                            }`}
                                    >
                                        {botOnline ? "ONLINE" : "OFFLINE"}
                                    </div>

                                    <button
                                        disabled={cfgSaving}
                                        onClick={() => toggleOnline(!botOnline)}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold shadow-sm transition disabled:opacity-60 ${botOnline
                                            ? "bg-rose-600 hover:bg-rose-700 text-white"
                                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            }`}
                                    >
                                        {cfgSaving ? "Saving..." : botOnline ? "Go Offline" : "Go Online"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* FLOW ACTIVE */}
                    <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                        <label className="inline-flex items-center gap-2 text-sm font-bold">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                            />
                            Enable ChatBot Flow
                        </label>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={addStep}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold shadow-sm"
                            >
                                <Plus size={18} /> Add Step
                            </button>

                            <button
                                onClick={onSave}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-extrabold shadow-sm disabled:opacity-60"
                            >
                                <Save size={18} /> {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="mt-6 text-sm text-slate-500">Loading...</div>
                    ) : mode === "preview" ? (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                                <div className="text-sm font-extrabold text-slate-900">Preview</div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Click options to simulate flow (WhatsApp/open links blocked)
                                </div>

                                <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                                    <div className="text-sm font-bold text-slate-700">{previewNode?.text}</div>
                                    <div className="mt-3 flex flex-col gap-2">
                                        {(previewNode?.options || []).map((o, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => previewClick(o.nextId)}
                                                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-left text-sm font-bold hover:bg-slate-950"
                                            >
                                                {o.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={previewBack}
                                            disabled={!previewHistory.length}
                                            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold disabled:opacity-50"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={previewReset}
                                            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="text-sm font-extrabold text-slate-900">Notes</div>
                                <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                                    Use these special nextId values anytime:
                                    <div className="mt-2 font-mono text-[11px] bg-slate-50 border border-gray-100 rounded-xl p-3">
                                        whatsapp_action{"\n"}
                                        open:/blog{"\n"}
                                        open:/contact{"\n"}
                                        open:/products{"\n"}
                                        open:/question-papers{"\n"}
                                        open:/guess-papers
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-5">
                            {/* LEFT: steps list */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-extrabold">Steps</div>
                                    <button
                                        onClick={async () => {
                                            setLoading(true);
                                            const data = await fetchFlow();
                                            if (data?.nodes && Object.keys(data.nodes).length) {
                                                setIsActive(data.isActive);
                                                setNodes(data.nodes);

                                                const keys = Object.keys(data.nodes);
                                                const fallback = keys.includes("root") ? ["root", ...keys.filter((k) => k !== "root").sort()] : keys.sort();
                                                const ord = data.order?.length ? data.order : fallback;

                                                setOrder(ord);
                                                setSelected(ord[0] || "root");
                                            }
                                            setLoading(false);
                                        }}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                                        title="Reload"
                                    >
                                        <RefreshCcw size={14} /> Reload
                                    </button>
                                </div>

                                <div className="mt-3 space-y-2">
                                    {order.map((id) => (
                                        <div
                                            key={id}
                                            className={`rounded-2xl border p-3 flex items-start gap-2 ${selected === id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
                                                }`}
                                        >
                                            <button
                                                className="mt-0.5 text-slate-400 hover:text-slate-700"
                                                title="Move up"
                                                onClick={() => moveStep(id, -1)}
                                            >
                                                <GripVertical size={16} />
                                            </button>

                                            <button className="flex-1 text-left" onClick={() => setSelected(id)}>
                                                <div className="text-xs font-extrabold text-slate-900">{id}</div>
                                                <div className="text-[11px] text-slate-500 line-clamp-2">
                                                    {safeStr(nodes[id]?.text) || "—"}
                                                </div>
                                            </button>

                                            {id !== "root" ? (
                                                <button
                                                    onClick={() => deleteStep(id)}
                                                    className="text-rose-600 hover:text-rose-800"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* RIGHT: editor */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                {!selectedNode ? (
                                    <div className="text-sm text-slate-500">Select a step</div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div>
                                                <div className="text-sm font-extrabold text-slate-900">Edit Step</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Step ID: <span className="font-mono">{selected}</span>
                                                </div>
                                            </div>

                                            <div className="text-[11px] font-bold text-slate-500">
                                                Tips: Use <span className="font-mono">whatsapp_action</span> or{" "}
                                                <span className="font-mono">open:/path</span>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="text-xs font-extrabold text-slate-700">Bot Message</label>
                                            <textarea
                                                value={selectedNode.text}
                                                onChange={(e) => updateStepText(e.target.value)}
                                                rows={3}
                                                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                        </div>

                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="text-xs font-extrabold text-slate-700">Options</div>
                                            <button
                                                onClick={addOption}
                                                className="text-xs font-extrabold text-blue-700 hover:text-blue-900"
                                            >
                                                + Add Option
                                            </button>
                                        </div>

                                        <div className="mt-3 space-y-3">
                                            {selectedNode.options.map((opt, idx) => (
                                                <div key={idx} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <div className="text-[11px] font-extrabold text-slate-600">Label</div>
                                                            <input
                                                                value={opt.label}
                                                                onChange={(e) => updateOption(idx, { label: e.target.value })}
                                                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="text-[11px] font-extrabold text-slate-600">Next Step ID</div>
                                                            <input
                                                                value={opt.nextId}
                                                                onChange={(e) => updateOption(idx, { nextId: e.target.value })}
                                                                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200"
                                                                placeholder="e.g. root OR whatsapp_action OR open:/blog"
                                                            />
                                                            {opt.nextId &&
                                                                !opt.nextId.startsWith("open:") &&
                                                                opt.nextId !== "whatsapp_action" &&
                                                                !allStepIds.has(opt.nextId) ? (
                                                                <div className="mt-1 text-[11px] font-bold text-amber-700">
                                                                    Warning: step "{opt.nextId}" does not exist yet.
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 flex justify-end">
                                                        <button
                                                            onClick={() => removeOption(idx)}
                                                            className="text-xs font-extrabold text-rose-600 hover:text-rose-800"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 text-[11px] text-slate-500 font-semibold">
                                            Recommended: Keep options 3–6 for best UX.
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-6 text-xs text-slate-500">
                        Next: We will connect this editor to your floating chatbot + add “Quick templates” for common flows.
                    </div>
                </div>
            </div>
        </main>
    );
}
