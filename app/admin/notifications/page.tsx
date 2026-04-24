"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  RefreshCcw,
  LoaderCircle,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Zap,
  ShieldCheck,
  Settings2,
  Layers3,
  Search,
  Play,
  Sparkles,
  Package,
  Boxes,
  FileArchive,
  Database,
  Activity,
  ChevronRight,
  Info,
} from "lucide-react";

type TaskStatus =
  | "idle"
  | "pending"
  | "needs_attention"
  | "running"
  | "completed"
  | "disabled";

type ActionIntent = "primary" | "secondary" | "danger";

type NotificationTaskAction = {
  key: string;
  label: string;
  intent?: ActionIntent;
};

type NotificationTask = {
  key: string;
  title: string;
  description: string;
  sectionKey: string;
  status: TaskStatus;
  pendingCount?: number;
  autoMode?: "auto" | "manual" | "hybrid";
  lastRunAt?: string | null;
  nextSuggestedAt?: string | null;
  note?: string;
  hint?: string;
  stats?: Array<{
    label: string;
    value: string | number;
  }>;
  actions?: NotificationTaskAction[];
};

type NotificationSection = {
  key: string;
  title: string;
  description: string;
  tone?: "amber" | "blue" | "emerald" | "violet" | "gray";
  tasks: NotificationTask[];
};

type NotificationEvent = {
  id: string;
  level: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  createdAt?: string | null;
};

type NotificationsApiResponse = {
  ok?: boolean;
  sections?: NotificationSection[];
  recentEvents?: NotificationEvent[];
  summary?: {
    totalTasks?: number;
    pendingTasks?: number;
    runningTasks?: number;
    needsAttentionTasks?: number;
  };
  autoRefreshSeconds?: number;
  source?: string;
  message?: string;
};

type ActionResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  section?: NotificationSection;
  sections?: NotificationSection[];
  recentEvents?: NotificationEvent[];
  summary?: {
    totalTasks?: number;
    pendingTasks?: number;
    runningTasks?: number;
    needsAttentionTasks?: number;
  };
};

type ProgressInfo = {
  percent: number | null;
  label: string;
  currentPhase?: string;
  hasMoreWork?: boolean;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function formatDateTime(input?: string | null) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN");
}

function toneWrap(
  tone: NotificationSection["tone"] = "gray"
): { wrap: string; icon: string; title: string } {
  if (tone === "amber") {
    return {
      wrap: "border-amber-200 bg-amber-50",
      icon: "text-amber-700",
      title: "text-amber-900",
    };
  }

  if (tone === "blue") {
    return {
      wrap: "border-blue-200 bg-blue-50",
      icon: "text-blue-700",
      title: "text-blue-900",
    };
  }

  if (tone === "emerald") {
    return {
      wrap: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-700",
      title: "text-emerald-900",
    };
  }

  if (tone === "violet") {
    return {
      wrap: "border-violet-200 bg-violet-50",
      icon: "text-violet-700",
      title: "text-violet-900",
    };
  }

  return {
    wrap: "border-gray-200 bg-gray-50",
    icon: "text-slate-700",
    title: "text-slate-900",
  };
}

function statusClasses(status: TaskStatus) {
  if (status === "running") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }

  if (status === "completed") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }

  if (status === "needs_attention") {
    return "bg-rose-100 text-rose-800 border border-rose-200";
  }

  if (status === "disabled") {
    return "bg-slate-100 text-slate-600 border border-slate-200";
  }

  return "bg-white text-slate-700 border border-slate-200";
}

function statusLabel(status: TaskStatus) {
  if (status === "running") return "Running";
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  if (status === "needs_attention") return "Needs Attention";
  if (status === "disabled") return "Disabled";
  return "Idle";
}

function actionButtonClasses(intent: ActionIntent = "secondary") {
  if (intent === "primary") {
    return "bg-slate-900 hover:bg-slate-950 text-white border border-slate-900";
  }

  if (intent === "danger") {
    return "bg-rose-600 hover:bg-rose-700 text-white border border-rose-600";
  }

  return "bg-white hover:bg-gray-50 text-slate-800 border border-gray-200";
}

function buildFallbackData(): NotificationsApiResponse {
  return {
    ok: true,
    source: "fallback",
    autoRefreshSeconds: 30,
    summary: {
      totalTasks: 7,
      pendingTasks: 3,
      runningTasks: 0,
      needsAttentionTasks: 0,
    },
    sections: [
      {
        key: "post-upload-syncs",
        title: "Post Upload Syncs",
        description:
          "Ye tasks product upload ke baad chalne chahiye. Inhe future me fully automatic ya hybrid mode par shift kiya ja sakta hai.",
        tone: "amber",
        tasks: [
          {
            key: "availability-sync",
            title: "Availability Sync",
            description:
              "Solved PDF aur official paper flags ke basis par latest uploaded products ki final availability sync karo.",
            sectionKey: "post-upload-syncs",
            status: "pending",
            pendingCount: 1,
            autoMode: "hybrid",
            note: "Product upload ke baad sabse pehle ye run karna better rahega.",
            hint: "Agar products recent bulk upload se aaye hain to ye task pending ho sakta hai.",
            stats: [
              { label: "Target SKUs", value: 0 },
              { label: "Progress", value: "0/0 (0%)" },
              { label: "Synced", value: 0 },
              { label: "Failed", value: 0 },
              { label: "Batch Size", value: 250 },
            ],
            actions: [
              { key: "run", label: "Run Now", intent: "primary" },
              { key: "schedule", label: "Mark for Auto" },
            ],
          },
          {
            key: "combo-sync",
            title: "Combo Sync",
            description:
              "Generated combo data ko bulk uploaded products ke against refresh karo.",
            sectionKey: "post-upload-syncs",
            status: "idle",
            pendingCount: 0,
            autoMode: "hybrid",
            note: "Ye task availability sync ke baad run karna aur bhi safe hota hai.",
            stats: [
              { label: "Phases", value: "0/0 (0%)" },
              { label: "Result Buckets", value: 0 },
              { label: "Include PYQ", value: "Yes" },
              { label: "Include Generic", value: "Yes" },
            ],
            actions: [
              { key: "run", label: "Run Now", intent: "primary" },
              { key: "schedule", label: "Mark for Auto" },
            ],
          },
          {
            key: "hardcopy-sync",
            title: "Hardcopy Sync",
            description:
              "Solved Assignments se auto-generated handwritten hardcopy products create/update karo.",
            sectionKey: "post-upload-syncs",
            status: "idle",
            pendingCount: 0,
            autoMode: "hybrid",
            note: "Ye task hardcopy auto-generation integrity ke liye important hai.",
            stats: [
              { label: "Eligible Sources", value: "—" },
              { label: "Progress", value: "0/0 (0%)" },
              { label: "Created", value: 0 },
              { label: "Updated", value: 0 },
              { label: "Failed", value: 0 },
            ],
            actions: [
              { key: "run", label: "Run Now", intent: "primary" },
              { key: "schedule", label: "Mark for Auto" },
            ],
          },
          {
            key: "run-all-post-syncs",
            title: "Run All Post Syncs",
            description:
              "Availability, Combo, aur Hardcopy tino sync ek saath sequentially run karo.",
            sectionKey: "post-upload-syncs",
            status: "idle",
            pendingCount: 0,
            autoMode: "manual",
            hint: "Emergency recovery ya bulk upload ke turant baad useful.",
            stats: [
              { label: "Includes", value: "3 tasks" },
              { label: "Latest Category", value: "—" },
              { label: "Progress", value: "0/0 (0%)" },
            ],
            actions: [{ key: "run", label: "Run Full Sync", intent: "primary" }],
          },
        ],
      },
      {
        key: "availability-rule-repair",
        title: "Availability Rule Repair",
        description:
          'Rule: only details = "Want to Buy", details + official paper = "On Demand", details + solved PDF = "Available". Ye section stale status mismatch ko repair karne ke liye hai.',
        tone: "violet",
        tasks: [
          {
            key: "availability-rule-sync-all-products",
            title: "Availability Rule Sync (All Products)",
            description:
              "Pure live product catalog par availability rule dobara run karo.",
            sectionKey: "availability-rule-repair",
            status: "idle",
            pendingCount: 0,
            autoMode: "manual",
            note: "Ye large repair mode hai. Jab poore catalog ko re-check karna ho tab use karo.",
            hint: "Manual repair sync. Safe to rerun.",
            stats: [
              { label: "Scope", value: "All live products" },
              { label: "Target Products", value: 0 },
              { label: "Progress", value: "0/0 (0%)" },
              { label: "Synced", value: 0 },
              { label: "Failed", value: 0 },
              { label: "Available", value: 0 },
              { label: "On Demand", value: 0 },
              { label: "Want to Buy", value: 0 },
            ],
            actions: [
              { key: "run", label: "Run All Products Sync", intent: "primary" },
            ],
          },
          {
            key: "availability-rule-sync-want-to-buy-only",
            title: "Availability Rule Sync (Only Want to Buy Products)",
            description:
              'Sirf current "Want to Buy" products ko re-check karo. PYQ mismatch fix karne ke liye ye fastest option hai.',
            sectionKey: "availability-rule-repair",
            status: "pending",
            pendingCount: 1,
            autoMode: "manual",
            note: 'Agar PYQ products galat tarah se "Want to Buy" dikh rahe hon, to ye option pehle run karo.',
            hint: "Manual repair sync. Safe to rerun.",
            stats: [
              { label: "Scope", value: 'Only current "Want to Buy" products' },
              { label: "Target Products", value: 0 },
              { label: "Progress", value: "0/0 (0%)" },
              { label: "Synced", value: 0 },
              { label: "Failed", value: 0 },
              { label: "Available", value: 0 },
              { label: "On Demand", value: 0 },
              { label: "Want to Buy", value: 0 },
            ],
            actions: [
              { key: "run", label: "Run Want to Buy Repair", intent: "primary" },
            ],
          },
        ],
      },
      {
        key: "system-notices",
        title: "System Notices",
        description:
          "Future me yahan aur admin notifications, migration tasks, repair jobs, audit checks aur reminders add kiye ja sakte hain.",
        tone: "blue",
        tasks: [
          {
            key: "bulk-upload-reminder",
            title: "Post Upload Reminder",
            description:
              "Jab new products upload ho jayein, to admin ko sync page check karne ka reminder show karo.",
            sectionKey: "system-notices",
            status: "completed",
            pendingCount: 0,
            autoMode: "manual",
            lastRunAt: new Date().toISOString(),
            stats: [
              { label: "Type", value: "Admin Reminder" },
              { label: "Expandable", value: "Yes" },
            ],
            actions: [{ key: "refresh", label: "Refresh Status" }],
          },
        ],
      },
    ],
    recentEvents: [
      {
        id: "evt-fallback-1",
        level: "info",
        title: "Fallback UI active",
        message:
          "Notifications UI preview mode me loaded hai. Backend data milte hi live tasks yahin show hongi.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function getTaskStatValue(task: NotificationTask, label: string) {
  const target = safeStr(label).toLowerCase();
  const item = (task.stats || []).find(
    (x) => safeStr(x.label).toLowerCase() === target
  );
  return item?.value;
}

function getTaskProgressInfo(task: NotificationTask): ProgressInfo | null {
  const progressRaw = getTaskStatValue(task, "Progress");
  const progressLabel = safeStr(progressRaw);

  if (!progressLabel) return null;

  const percentMatch = progressLabel.match(/(\d+)\s*%/);
  const percent =
    percentMatch && Number.isFinite(Number(percentMatch[1]))
      ? Math.max(0, Math.min(100, Number(percentMatch[1])))
      : null;

  const currentPhase = safeStr(getTaskStatValue(task, "Current Phase"));
  const hasMoreWorkValue = safeStr(getTaskStatValue(task, "Has More Work")).toLowerCase();

  return {
    percent,
    label: progressLabel,
    currentPhase: currentPhase || undefined,
    hasMoreWork:
      hasMoreWorkValue === "yes"
        ? true
        : hasMoreWorkValue === "no"
        ? false
        : undefined,
  };
}

function progressTrackClasses(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-100";
  if (status === "needs_attention") return "bg-rose-100";
  if (status === "running") return "bg-blue-100";
  if (status === "pending") return "bg-amber-100";
  return "bg-slate-100";
}

function progressBarClasses(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "needs_attention") return "bg-rose-500";
  if (status === "running") return "bg-blue-500";
  if (status === "pending") return "bg-amber-500";
  return "bg-slate-400";
}

export default function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [data, setData] = useState<NotificationsApiResponse>(buildFallbackData());
  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [runningActionKey, setRunningActionKey] = useState("");

  async function safeReadJson(res: Response) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function loadNotifications(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/admin/notifications/tasks", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const fallback = buildFallbackData();
        setData(fallback);
        setServerMessage(
          "Notifications backend temporarily unavailable hai. Fallback preview UI show ho rahi hai."
        );
        setServerMessageType("info");
        return;
      }

      const json = (await safeReadJson(res)) as NotificationsApiResponse;

      if (!json?.ok) {
        const fallback = buildFallbackData();
        setData(fallback);
        setServerMessage(
          safeStr(json?.message) ||
            "Notifications data fallback mode me show ho rahi hai."
        );
        setServerMessageType("info");
        return;
      }

      setData({
        ...buildFallbackData(),
        ...json,
        sections:
          Array.isArray(json.sections) && json.sections.length
            ? json.sections
            : buildFallbackData().sections,
        recentEvents:
          Array.isArray(json.recentEvents) && json.recentEvents.length
            ? json.recentEvents
            : buildFallbackData().recentEvents,
      });

      setServerMessage("");
    } catch {
      const fallback = buildFallbackData();
      setData(fallback);
      setServerMessage(
        "Network ya route issue ki wajah se fallback notifications preview show ho rahi hai."
      );
      setServerMessageType("info");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function runTask(task: NotificationTask, action: NotificationTaskAction) {
    const actionKey = `${task.key}__${action.key}`;
    setRunningActionKey(actionKey);

    try {
      const res = await fetch("/api/admin/notifications/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskKey: task.key,
          actionKey: action.key,
        }),
      });

      const json = (await safeReadJson(res)) as ActionResponse;

      if (!res.ok || !json?.ok) {
        setServerMessage(
          safeStr(json?.error) || "Task run request fail hui."
        );
        setServerMessageType("error");

        if (Array.isArray(json.sections) && json.sections.length) {
          setData((prev) => ({
            ...prev,
            sections: json.sections,
            recentEvents: Array.isArray(json.recentEvents)
              ? json.recentEvents
              : prev.recentEvents,
            summary: json.summary || prev.summary,
          }));
        }
        return;
      }

      setServerMessage(
        safeStr(json?.message) || "Task successfully queued / executed."
      );
      setServerMessageType("success");

      if (Array.isArray(json.sections) && json.sections.length) {
        setData((prev) => ({
          ...prev,
          sections: json.sections,
          recentEvents: Array.isArray(json.recentEvents)
            ? json.recentEvents
            : prev.recentEvents,
          summary: json.summary || prev.summary,
        }));
      } else {
        await loadNotifications(true);
      }
    } catch {
      setServerMessage("Task run request fail hui. Please retry.");
      setServerMessageType("error");
    } finally {
      setRunningActionKey("");
    }
  }

  useEffect(() => {
    loadNotifications(false);
  }, []);

  useEffect(() => {
    const seconds = Number(data?.autoRefreshSeconds || 0);
    if (!seconds || seconds < 3) return;

    const t = setInterval(() => {
      loadNotifications(true);
    }, seconds * 1000);

    return () => clearInterval(t);
  }, [data?.autoRefreshSeconds]);

  const summary = useMemo(() => {
    const sections = Array.isArray(data?.sections) ? data.sections : [];
    const tasks = sections.flatMap((section) => section.tasks || []);

    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter((t) => t.status === "pending").length;
    const runningTasks = tasks.filter((t) => t.status === "running").length;
    const needsAttentionTasks = tasks.filter(
      (t) => t.status === "needs_attention"
    ).length;

    return {
      totalTasks:
        Number(data?.summary?.totalTasks || 0) > 0
          ? Number(data?.summary?.totalTasks || 0)
          : totalTasks,
      pendingTasks:
        Number(data?.summary?.pendingTasks || 0) > 0
          ? Number(data?.summary?.pendingTasks || 0)
          : pendingTasks,
      runningTasks:
        Number(data?.summary?.runningTasks || 0) > 0
          ? Number(data?.summary?.runningTasks || 0)
          : runningTasks,
      needsAttentionTasks:
        Number(data?.summary?.needsAttentionTasks || 0) > 0
          ? Number(data?.summary?.needsAttentionTasks || 0)
          : needsAttentionTasks,
    };
  }, [data]);

  const filteredSections = useMemo(() => {
    const sections = Array.isArray(data?.sections) ? data.sections : [];
    const q = safeStr(query).toLowerCase();

    return sections
      .map((section) => {
        const tasks = (section.tasks || []).filter((task) => {
          const matchesStatus =
            statusFilter === "all" ? true : task.status === statusFilter;

          const haystack = [
            task.title,
            task.description,
            task.note,
            task.hint,
            section.title,
            ...(task.stats || []).flatMap((s) => [s.label, String(s.value ?? "")]),
          ]
            .map((x) => safeStr(x).toLowerCase())
            .join(" ");

          const matchesQuery = !q || haystack.includes(q);

          return matchesStatus && matchesQuery;
        });

        return {
          ...section,
          tasks,
        };
      })
      .filter((section) => section.tasks.length > 0);
  }, [data, query, statusFilter]);

  const recentEvents = Array.isArray(data?.recentEvents) ? data.recentEvents : [];
  const anyRunningTask = summary.runningTasks > 0;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-extrabold text-amber-800">
                <BellRing size={14} />
                Admin Notifications Center
              </div>

              <h1 className="text-2xl font-extrabold mt-3">Notifications</h1>
              <p className="text-sm text-slate-600 mt-1">
                Yahin se aap post-upload syncs, repair jobs, reminders aur future admin actions
                manage kar sakte ho.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => loadNotifications(true)}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                {refreshing ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <RefreshCcw size={18} />
                )}
                Refresh
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>
            </div>
          </div>

          {anyRunningTask ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <LoaderCircle size={18} className="mt-0.5 shrink-0 animate-spin text-blue-700" />
                <div>
                  <div className="text-sm font-extrabold text-blue-900">
                    Live sync in progress
                  </div>
                  <div className="text-sm text-blue-800 mt-1">
                    Page auto-refresh ho rahi hai, isliye current running progress yahin live update hoti rahegi.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {serverMessage ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${
                serverMessageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : serverMessageType === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {serverMessageType === "success" ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                ) : serverMessageType === "error" ? (
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={18} className="mt-0.5 shrink-0" />
                )}
                <div>{serverMessage}</div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Total Tasks
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {summary.totalTasks}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                Pending
              </div>
              <div className="mt-2 text-2xl font-extrabold text-amber-900">
                {summary.pendingTasks}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-blue-700">
                Running
              </div>
              <div className="mt-2 text-2xl font-extrabold text-blue-900">
                {summary.runningTasks}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-rose-700">
                Needs Attention
              </div>
              <div className="mt-2 text-2xl font-extrabold text-rose-900">
                {summary.needsAttentionTasks}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-6 min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search size={16} className="text-slate-700" />
                  <div className="text-sm font-extrabold">Filters</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                    placeholder="Search tasks, repair syncs, alerts..."
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as "all" | TaskStatus)
                    }
                    className="px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="running">Running</option>
                    <option value="needs_attention">Needs Attention</option>
                    <option value="completed">Completed</option>
                    <option value="idle">Idle</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-slate-600 font-bold flex items-center gap-3">
                  <LoaderCircle size={18} className="animate-spin" />
                  Loading notifications...
                </div>
              ) : filteredSections.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-slate-600 font-bold">
                  No matching notification tasks found.
                </div>
              ) : (
                filteredSections.map((section) => {
                  const tone = toneWrap(section.tone);

                  return (
                    <section
                      key={section.key}
                      className={`rounded-3xl border p-5 shadow-sm ${tone.wrap}`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <Layers3 size={18} className={tone.icon} />
                            <h2 className={`text-lg font-extrabold ${tone.title}`}>
                              {section.title}
                            </h2>
                          </div>
                          <p className="text-sm text-slate-600 mt-2">
                            {section.description}
                          </p>
                        </div>

                        <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-white text-slate-700 border border-gray-200">
                          {section.tasks.length} task
                          {section.tasks.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {section.tasks.map((task) => {
                          const progressInfo = getTaskProgressInfo(task);
                          const filteredStats = (task.stats || []).filter(
                            (item) =>
                              !["progress", "current phase", "has more work"].includes(
                                safeStr(item.label).toLowerCase()
                              )
                          );

                          return (
                            <div
                              key={task.key}
                              className="rounded-2xl border border-white/70 bg-white p-5 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="font-extrabold text-slate-900">
                                      {task.title}
                                    </div>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusClasses(
                                        task.status
                                      )}`}
                                    >
                                      {task.status === "running" ? (
                                        <LoaderCircle
                                          size={12}
                                          className="mr-1 animate-spin"
                                        />
                                      ) : task.status === "completed" ? (
                                        <CheckCircle2 size={12} className="mr-1" />
                                      ) : task.status === "pending" ? (
                                        <Clock3 size={12} className="mr-1" />
                                      ) : task.status === "needs_attention" ? (
                                        <AlertTriangle size={12} className="mr-1" />
                                      ) : (
                                        <Sparkles size={12} className="mr-1" />
                                      )}
                                      {statusLabel(task.status)}
                                    </span>

                                    {task.autoMode ? (
                                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                        <Settings2 size={12} className="mr-1" />
                                        {task.autoMode === "auto"
                                          ? "Auto"
                                          : task.autoMode === "hybrid"
                                          ? "Hybrid"
                                          : "Manual"}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="text-sm text-slate-600 mt-2 leading-6">
                                    {task.description}
                                  </div>
                                </div>

                                {Number(task.pendingCount || 0) > 0 ? (
                                  <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                    {task.pendingCount} pending
                                  </div>
                                ) : null}
                              </div>

                              {progressInfo ? (
                                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                                      Sync Progress
                                    </div>
                                    <div className="text-xs font-bold text-slate-700">
                                      {progressInfo.label}
                                    </div>
                                  </div>

                                  <div
                                    className={`mt-3 h-3 w-full overflow-hidden rounded-full ${progressTrackClasses(
                                      task.status
                                    )}`}
                                  >
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${progressBarClasses(
                                        task.status
                                      )} ${
                                        task.status === "running"
                                          ? "animate-pulse"
                                          : ""
                                      }`}
                                      style={{
                                        width: `${Math.max(
                                          0,
                                          Math.min(100, Number(progressInfo.percent ?? 0))
                                        )}%`,
                                      }}
                                    />
                                  </div>

                                  {(progressInfo.currentPhase ||
                                    progressInfo.hasMoreWork !== undefined) && (
                                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap text-xs">
                                      {progressInfo.currentPhase ? (
                                        <div className="text-slate-700">
                                          <span className="font-extrabold">Phase:</span>{" "}
                                          {progressInfo.currentPhase}
                                        </div>
                                      ) : (
                                        <div />
                                      )}

                                      {progressInfo.hasMoreWork !== undefined ? (
                                        <div
                                          className={`font-extrabold ${
                                            progressInfo.hasMoreWork
                                              ? "text-amber-700"
                                              : "text-emerald-700"
                                          }`}
                                        >
                                          {progressInfo.hasMoreWork
                                            ? "More work pending"
                                            : "No remaining work"}
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {(task.note || task.hint) && (
                                <div className="mt-4 space-y-2">
                                  {task.note ? (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                      <span className="font-extrabold">Note:</span>{" "}
                                      {task.note}
                                    </div>
                                  ) : null}

                                  {task.hint ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                      <span className="font-extrabold">Hint:</span>{" "}
                                      {task.hint}
                                    </div>
                                  ) : null}
                                </div>
                              )}

                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                                    Last Run
                                  </div>
                                  <div className="mt-1 text-sm font-bold text-slate-900">
                                    {formatDateTime(task.lastRunAt)}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                                    Suggested Next
                                  </div>
                                  <div className="mt-1 text-sm font-bold text-slate-900">
                                    {formatDateTime(task.nextSuggestedAt)}
                                  </div>
                                </div>
                              </div>

                              {filteredStats.length ? (
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                  {filteredStats.map((item) => (
                                    <div
                                      key={`${task.key}-${item.label}`}
                                      className="rounded-xl border border-slate-200 bg-white p-3"
                                    >
                                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                                        {item.label}
                                      </div>
                                      <div className="mt-1 text-sm font-bold text-slate-900">
                                        {item.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-5 flex items-center gap-2 flex-wrap">
                                {(task.actions || []).map((action) => {
                                  const actionKey = `${task.key}__${action.key}`;
                                  const isRunning = runningActionKey === actionKey;

                                  return (
                                    <button
                                      key={actionKey}
                                      type="button"
                                      onClick={() => runTask(task, action)}
                                      disabled={Boolean(runningActionKey)}
                                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition font-extrabold shadow-sm disabled:opacity-60 ${actionButtonClasses(
                                        action.intent || "secondary"
                                      )}`}
                                    >
                                      {isRunning ? (
                                        <LoaderCircle size={16} className="animate-spin" />
                                      ) : action.intent === "primary" ? (
                                        <Play size={16} />
                                      ) : (
                                        <ChevronRight size={16} />
                                      )}
                                      {isRunning ? "Running..." : action.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-slate-700" />
                  <div className="text-sm font-extrabold">Recent Activity</div>
                </div>

                <div className="mt-4 space-y-3">
                  {recentEvents.length ? (
                    recentEvents.slice(0, 8).map((event) => {
                      const eventWrap =
                        event.level === "success"
                          ? "border-emerald-200 bg-emerald-50"
                          : event.level === "warning"
                          ? "border-amber-200 bg-amber-50"
                          : event.level === "error"
                          ? "border-rose-200 bg-rose-50"
                          : "border-slate-200 bg-slate-50";

                      return (
                        <div
                          key={event.id}
                          className={`rounded-xl border p-3 ${eventWrap}`}
                        >
                          <div className="font-bold text-slate-900">
                            {event.title}
                          </div>
                          <div className="text-xs text-slate-600 mt-1 leading-5">
                            {event.message}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-2">
                            {formatDateTime(event.createdAt)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                      No recent activity found.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-700" />
                  <div className="text-sm font-extrabold text-blue-900">
                    Design Intent
                  </div>
                </div>

                <div className="mt-3 text-sm text-blue-800 leading-6">
                  Is page ko future-safe structure par banaya gaya hai. Kal ko yahin par:
                  product repair tasks, migration jobs, cache rebuild, audit checks, reminder
                  notifications aur sync alerts add kiye ja sakte hain.
                </div>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-violet-700" />
                  <div className="text-sm font-extrabold text-violet-900">
                    Suggested First Use
                  </div>
                </div>

                <div className="mt-3 text-sm text-violet-800 leading-6">
                  Product upload ke turant baad yahin se:
                  <br />
                  1. Availability Sync
                  <br />
                  2. Combo Sync
                  <br />
                  3. Hardcopy Sync
                  <br />
                  ya directly <b>Run Full Sync</b> chalaya ja sakta hai.
                  <br />
                  <br />
                  Agar stale mismatch ho, especially PYQ products me, to:
                  <br />
                  <b>Run Want to Buy Repair</b>
                  <br />
                  aur zarurat padne par
                  <br />
                  <b>Run All Products Sync</b>.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-slate-700" />
                  <div className="text-sm font-extrabold">Future Groups</div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                    <Package size={15} />
                    Product Integrity
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                    <Boxes size={15} />
                    Combo & Bundle Ops
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                    <FileArchive size={15} />
                    File / Vault Repairs
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                    <BellRing size={15} />
                    Admin Alerts
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}