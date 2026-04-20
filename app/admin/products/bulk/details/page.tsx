"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCcw,
  Info,
  Lock,
  Download,
  Play,
  PauseCircle,
  LoaderCircle,
  Settings2,
  Server,
  FileUp,
  Activity,
} from "lucide-react";
import { CATEGORY_CONFIG, PHYSICAL_CATEGORY } from "@/lib/productCatalog";

type DefaultTemplateItem = {
  category: string;
  titleTemplate: string;
  importantNoteTemplate: string;
  shortDescTemplate: string;
  longDescTemplate: string;
  slugTemplate: string;
  metaTitleTemplate: string;
  metaDescriptionTemplate: string;
  publishNow: boolean;
};

type DefaultTemplatesApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  categories?: string[];
  item?: DefaultTemplateItem;
  items?: DefaultTemplateItem[];
  itemMap?: Record<string, DefaultTemplateItem>;
  defaults?: Record<string, DefaultTemplateItem>;
  meta?: {
    key?: string;
    updatedBy?: string;
    updatedAt?: string | null;
    createdAt?: string | null;
  };
};

type BulkJobFailureRow = {
  itemIndex?: number;
  rowNumber?: number;
  batchNumber?: number;
  identifier?: string;
  sku?: string;
  fileName?: string;
  status?: string;
  reason?: string;
  createdAt?: string | null;
};

type BulkJobProgress = {
  totalItems?: number;
  processedItems?: number;
  successItems?: number;
  failedItems?: number;
  skippedItems?: number;
  validItems?: number;
  batchSize?: number;
  batchCount?: number;
  currentBatchNumber?: number;
  lastProcessedIndex?: number;
  progressPercent?: number;
};

type BulkJobLastBatch = {
  batchNumber?: number;
  fromIndex?: number;
  toIndex?: number;
  attempted?: number;
  success?: number;
  failed?: number;
  skipped?: number;
  startedAt?: string | null;
  endedAt?: string | null;
  note?: string;
} | null;

type BulkJob = {
  _id: string;
  jobType?: string;
  jobLabel?: string;
  status?: string;
  createdBy?: string;
  meta?: Record<string, any>;
  config?: Record<string, any>;
  summary?: Record<string, any>;
  progress?: BulkJobProgress;
  lastBatch?: BulkJobLastBatch;
  failuresCount?: number;
  recentFailures?: BulkJobFailureRow[];
  resultMessage?: string;
  downloadFileName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ActiveJobResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  hasActiveJob?: boolean;
  activeJob?: BulkJob | null;
  latestJob?: BulkJob | null;
  job?: BulkJob | null;
};

type CreateJobResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  job?: BulkJob | null;
};

type JobActionResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  action?: string;
  job?: BulkJob | null;
};

type ProcessJobResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  processingState?: string;
  stats?: {
    processedSteps?: number;
    failedSteps?: number;
    elapsedMs?: number;
    maxSteps?: number;
  };
  job?: BulkJob | null;
};

const DEFAULT_NOTE =
  "Please verify the question paper shown in the preview/thumbnail before purchasing. Purchase only if it matches your subject code, medium, session, and questions.";

const DEFAULT_TITLE_TEMPLATE = "IGNOU %B Solved Assignment %C (%D Medium)";
const DEFAULT_SHORT_DESC_TEMPLATE =
  "Download IGNOU %B (%F) solved assignment for session %C in %D medium.";
const DEFAULT_LONG_DESC_TEMPLATE =
  "This IGNOU %B (%F) solved assignment is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.";
const DEFAULT_META_TITLE_TEMPLATE =
  "IGNOU %B Solved Assignment %C (%D Medium) PDF Download";
const DEFAULT_META_DESCRIPTION_TEMPLATE =
  "Download IGNOU %B (%F) solved assignment for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.";

const TOKEN_HELP = [
  "%A = Unique Id (SKU)",
  "%B = Subject Code",
  "%C = Session",
  "%D = Language",
  "%E = Course Code",
  "%F = Subject Title (language matched from master subjects)",
  "%G = Course Title (from master courses)",
];

const SAMPLE_CSV = `unique_id,subject_code,session,language,course_code
BHIC131ENG202526,BHIC 131,2025-2026,English,BAHIH
BHIC132HIN202526,BHIC 132,2025-2026,Hindi,BAHIH
BEGC101ENG202526,BEGC 101,2025-2026,English,BAEGH
BPSC101ENG202526,BPSC 101,2025-2026,English,"BAPSH, BAG"`;

const POLL_INTERVAL_MS = 5000;
const PROCESS_MAX_STEPS_PER_REQUEST = 20;
const PROCESS_LOOP_DELAY_MS = 150;

function notifyLongTaskStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-long-task-start"));
  }
}

function notifyLongTaskEnd() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-long-task-end"));
  }
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  if (typeof x === "number") {
    if (x === 1) return true;
    if (x === 0) return false;
  }
  return def;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return { ok: false, error: "Server returned empty response" };

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: text.slice(0, 500) || "Invalid server response",
    };
  }
}

function formatDateTime(input?: string | null) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN");
}

function isFinalJobStatus(status: string) {
  const s = safeStr(status);
  return (
    s === "completed" ||
    s === "completed_with_errors" ||
    s === "failed" ||
    s === "cancelled"
  );
}

function statusPillClasses(status: string) {
  const s = safeStr(status);

  if (s === "paused_manual") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (s === "completed") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (s === "completed_with_errors") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (s === "failed" || s === "cancelled") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  if (s === "running" || s === "processing_batch" || s === "queued") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function humanJobStatus(status: string) {
  const s = safeStr(status);

  if (s === "paused_manual") return "Paused";
  if (s === "completed") return "Completed";
  if (s === "completed_with_errors") return "Completed with errors";
  if (s === "failed") return "Failed";
  if (s === "cancelled") return "Cancelled";
  if (s === "processing_batch") return "Processing";
  if (s === "running") return "Running";
  if (s === "queued") return "Saved / Ready";

  return s || "Unknown";
}

function normalizeTemplateItem(input: any, category: string): DefaultTemplateItem {
  return {
    category,
    titleTemplate: safeStr(input?.titleTemplate),
    importantNoteTemplate: safeStr(input?.importantNoteTemplate),
    shortDescTemplate: safeStr(input?.shortDescTemplate),
    longDescTemplate: safeStr(input?.longDescTemplate),
    slugTemplate: safeStr(input?.slugTemplate),
    metaTitleTemplate: safeStr(input?.metaTitleTemplate),
    metaDescriptionTemplate: safeStr(input?.metaDescriptionTemplate),
    publishNow: safeBool(input?.publishNow, false),
  };
}

function buildFallbackTemplateMap(): Record<string, DefaultTemplateItem> {
  return {
    "Solved Assignments": {
      category: "Solved Assignments",
      titleTemplate: DEFAULT_TITLE_TEMPLATE,
      importantNoteTemplate: DEFAULT_NOTE,
      shortDescTemplate: DEFAULT_SHORT_DESC_TEMPLATE,
      longDescTemplate: DEFAULT_LONG_DESC_TEMPLATE,
      slugTemplate: "",
      metaTitleTemplate: DEFAULT_META_TITLE_TEMPLATE,
      metaDescriptionTemplate: DEFAULT_META_DESCRIPTION_TEMPLATE,
      publishNow: false,
    },

    "Question Papers (PYQ)": {
      category: "Question Papers (PYQ)",
      titleTemplate: "IGNOU %B Question Paper %C (%D Medium)",
      importantNoteTemplate: DEFAULT_NOTE,
      shortDescTemplate:
        "Download IGNOU %B (%F) question paper for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) question paper is mapped for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Question Paper %C (%D Medium) PDF Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) question paper for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: true,
    },

    "Handwritten PDFs": {
      category: "Handwritten PDFs",
      titleTemplate: "IGNOU %B Handwritten PDF %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this handwritten PDF.",
      shortDescTemplate:
        "Download IGNOU %B (%F) handwritten PDF for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) handwritten PDF is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Handwritten PDF %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) handwritten PDF for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    Ebooks: {
      category: "Ebooks",
      titleTemplate: "IGNOU %B Ebook %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this ebook.",
      shortDescTemplate:
        "Download IGNOU %B (%F) ebook for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) ebook is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Ebook %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) ebook for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    projects: {
      category: "projects",
      titleTemplate: "IGNOU %B Project %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this project file.",
      shortDescTemplate:
        "Download IGNOU %B (%F) project material for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) project material is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Project %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) project material for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },

    "Guess Papers": {
      category: "Guess Papers",
      titleTemplate: "IGNOU %B Guess Paper %C (%D Medium)",
      importantNoteTemplate:
        "Please verify subject code, medium, session, and course details before purchasing this guess paper.",
      shortDescTemplate:
        "Download IGNOU %B (%F) guess paper for session %C in %D medium.",
      longDescTemplate:
        "This IGNOU %B (%F) guess paper is prepared for session %C in %D medium. Course title is auto-matched from master data: %G.",
      slugTemplate: "",
      metaTitleTemplate: "IGNOU %B Guess Paper %C (%D Medium) Download",
      metaDescriptionTemplate:
        "Download IGNOU %B (%F) guess paper for session %C in %D medium. Course title: %G. Instant access and verified subject mapping.",
      publishNow: false,
    },
  };
}

function csvCell(input: any) {
  const raw = safeStr(input).replace(/\r?\n/g, " ");
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildRecentFailuresCsv(rows: BulkJobFailureRow[]) {
  const header = [
    "Item Index",
    "Row Number",
    "Batch Number",
    "Identifier",
    "SKU",
    "Status",
    "Reason",
    "Created At",
  ];

  const body = rows.map((row) =>
    [
      csvCell(row?.itemIndex),
      csvCell(row?.rowNumber),
      csvCell(row?.batchNumber),
      csvCell(row?.identifier),
      csvCell(row?.sku),
      csvCell(row?.status),
      csvCell(row?.reason),
      csvCell(row?.createdAt),
    ].join(",")
  );

  return [header.map(csvCell).join(","), ...body].join("\n");
}

export default function BulkDetailsPage() {
  const allowedCategories = useMemo(
    () =>
      CATEGORY_CONFIG.filter((c) => c.label !== PHYSICAL_CATEGORY).map(
        (c) => c.label
      ),
    []
  );

  const fallbackTemplateMap = useMemo(() => buildFallbackTemplateMap(), []);
  const initialDefaultsAppliedRef = useRef(false);
  const longTaskActiveRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const processorStopRef = useRef(false);
  const processorRunIdRef = useRef(0);
  const mountedRef = useRef(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [isCancellingJob, setIsCancellingJob] = useState(false);
  const [isRefreshingJob, setIsRefreshingJob] = useState(false);
  const [isProcessingJob, setIsProcessingJob] = useState(false);
  const [isPausingJob, setIsPausingJob] = useState(false);
  const [isResumingJob, setIsResumingJob] = useState(false);
  const [defaultsHydrated, setDefaultsHydrated] = useState(false);

  const [defaultTemplateMap, setDefaultTemplateMap] =
    useState<Record<string, DefaultTemplateItem>>(fallbackTemplateMap);

  const [currentJob, setCurrentJob] = useState<BulkJob | null>(null);

  const [form, setForm] = useState({
    category: "Solved Assignments",
    titleTemplate: DEFAULT_TITLE_TEMPLATE,
    importantNoteTemplate: DEFAULT_NOTE,
    shortDescTemplate: DEFAULT_SHORT_DESC_TEMPLATE,
    longDescTemplate: DEFAULT_LONG_DESC_TEMPLATE,
    slugTemplate: "",
    metaTitleTemplate: DEFAULT_META_TITLE_TEMPLATE,
    metaDescriptionTemplate: DEFAULT_META_DESCRIPTION_TEMPLATE,
    publishNow: false,
    csvText: "",
    duplicateStrategy: "ignore" as "replace" | "ignore",
  });

  function getTemplateForCategory(category: string) {
    const normalizedCategory = safeStr(category) || "Solved Assignments";
    return (
      defaultTemplateMap[normalizedCategory] ||
      fallbackTemplateMap[normalizedCategory] ||
      fallbackTemplateMap["Solved Assignments"]
    );
  }

  function applyCategoryDefaults(nextCategory: string) {
    const template = getTemplateForCategory(nextCategory);

    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      titleTemplate: safeStr(template?.titleTemplate),
      importantNoteTemplate: safeStr(template?.importantNoteTemplate),
      shortDescTemplate: safeStr(template?.shortDescTemplate),
      longDescTemplate: safeStr(template?.longDescTemplate),
      slugTemplate: safeStr(template?.slugTemplate),
      metaTitleTemplate: safeStr(template?.metaTitleTemplate),
      metaDescriptionTemplate: safeStr(template?.metaDescriptionTemplate),
      publishNow: safeBool(template?.publishNow, false),
    }));
  }

  async function loadDefaultTemplates() {
    try {
      const res = await fetch(
        "/api/admin/products/bulk/details/default-templates",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = (await safeReadJson(res)) as DefaultTemplatesApiResponse;

      if (!res.ok || !data?.ok) {
        setDefaultsHydrated(true);
        return;
      }

      const categories =
        Array.isArray(data?.categories) && data.categories.length
          ? data.categories
          : allowedCategories;

      const nextMap: Record<string, DefaultTemplateItem> = {};

      for (const category of categories) {
        nextMap[category] = normalizeTemplateItem(
          data?.itemMap?.[category] ||
            data?.defaults?.[category] ||
            fallbackTemplateMap[category],
          category
        );
      }

      setDefaultTemplateMap((prev) => ({ ...prev, ...nextMap }));
      setDefaultsHydrated(true);

      if (!initialDefaultsAppliedRef.current) {
        initialDefaultsAppliedRef.current = true;

        setForm((prev) => {
          const currentCategory = safeStr(prev.category) || "Solved Assignments";
          const template =
            nextMap[currentCategory] ||
            fallbackTemplateMap[currentCategory] ||
            fallbackTemplateMap["Solved Assignments"];

          return {
            ...prev,
            category: currentCategory,
            titleTemplate: safeStr(template?.titleTemplate),
            importantNoteTemplate: safeStr(template?.importantNoteTemplate),
            shortDescTemplate: safeStr(template?.shortDescTemplate),
            longDescTemplate: safeStr(template?.longDescTemplate),
            slugTemplate: safeStr(template?.slugTemplate),
            metaTitleTemplate: safeStr(template?.metaTitleTemplate),
            metaDescriptionTemplate: safeStr(template?.metaDescriptionTemplate),
            publishNow: safeBool(template?.publishNow, false),
          };
        });
      }
    } catch {
      setDefaultsHydrated(true);
    }
  }

  function resetMessages() {
    setServerMessage("");
    setServerMessageType("info");
  }

  function fillSample() {
    setForm((p) => ({ ...p, csvText: SAMPLE_CSV }));
    setUploadFile(null);
    resetMessages();
  }

  function resetFileInput() {
    setUploadFile(null);
    const input = document.getElementById(
      "bulk-details-file-input"
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function resetFormToCurrentCategoryDefaults() {
    const currentCategory = safeStr(form.category) || "Solved Assignments";
    const template = getTemplateForCategory(currentCategory);

    setForm({
      category: currentCategory,
      titleTemplate: safeStr(template?.titleTemplate),
      importantNoteTemplate: safeStr(template?.importantNoteTemplate),
      shortDescTemplate: safeStr(template?.shortDescTemplate),
      longDescTemplate: safeStr(template?.longDescTemplate),
      slugTemplate: safeStr(template?.slugTemplate),
      metaTitleTemplate: safeStr(template?.metaTitleTemplate),
      metaDescriptionTemplate: safeStr(template?.metaDescriptionTemplate),
      publishNow: safeBool(template?.publishNow, false),
      csvText: "",
      duplicateStrategy: "ignore",
    });
  }

  const canSubmit = useMemo(() => {
    return (
      safeStr(form.category) &&
      safeStr(form.titleTemplate) &&
      (safeStr(form.csvText) || uploadFile)
    );
  }, [form, uploadFile]);

  const activeJobExists = useMemo(() => {
    return currentJob ? !isFinalJobStatus(safeStr(currentJob.status)) : false;
  }, [currentJob]);

  const canStartNewJob = useMemo(() => {
    return (
      !isSubmittingJob &&
      !isProcessingJob &&
      !isPausingJob &&
      !isResumingJob &&
      !isCancellingJob &&
      !activeJobExists &&
      canSubmit
    );
  }, [
    isSubmittingJob,
    isProcessingJob,
    isPausingJob,
    isResumingJob,
    isCancellingJob,
    activeJobExists,
    canSubmit,
  ]);

  const summary = currentJob?.summary || {};
  const progress = currentJob?.progress || {};
  const lastBatch = currentJob?.lastBatch || null;
  const recentFailures = Array.isArray(currentJob?.recentFailures)
    ? currentJob.recentFailures
    : [];

  const needsManualResume = useMemo(() => {
    return Boolean(
      currentJob &&
        !isFinalJobStatus(safeStr(currentJob.status)) &&
        safeBool(summary.needsManualResume, false)
    );
  }, [currentJob, summary]);

  const currentJobVisualStatus = useMemo(() => {
    if (!currentJob) return "";
    if (
      !isFinalJobStatus(safeStr(currentJob.status)) &&
      safeBool(summary.needsManualResume, false)
    ) {
      return "paused_manual";
    }
    return safeStr(currentJob.status);
  }, [currentJob, summary]);

  const canResumeSavedJob = useMemo(() => {
    return Boolean(
      currentJob &&
        !isFinalJobStatus(safeStr(currentJob.status)) &&
        !isProcessingJob &&
        !isSubmittingJob &&
        !isPausingJob &&
        !isResumingJob &&
        !isCancellingJob
    );
  }, [
    currentJob,
    isProcessingJob,
    isSubmittingJob,
    isPausingJob,
    isResumingJob,
    isCancellingJob,
  ]);

  const canPauseSavedJob = useMemo(() => {
    return Boolean(
      currentJob &&
        !isFinalJobStatus(safeStr(currentJob.status)) &&
        !needsManualResume &&
        !isPausingJob &&
        !isResumingJob &&
        !isCancellingJob
    );
  }, [currentJob, needsManualResume, isPausingJob, isResumingJob, isCancellingJob]);

  const jobProgressPercent = useMemo(() => {
    const fromApi = safeNum(currentJob?.progress?.progressPercent, -1);
    if (fromApi >= 0) return Math.max(0, Math.min(100, fromApi));

    const total = safeNum(currentJob?.progress?.totalItems, 0);
    const processed = safeNum(currentJob?.progress?.processedItems, 0);
    if (!total) return 0;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [currentJob]);

  async function fetchCurrentJob(showSpinner = false) {
    if (showSpinner) setIsRefreshingJob(true);

    try {
      const res = await fetch(
        "/api/admin/products/bulk/details/jobs/active",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = (await safeReadJson(res)) as ActiveJobResponse;

      if (!res.ok || !data?.ok) return;

      setCurrentJob(data?.job || null);
    } catch {
      // ignore
    } finally {
      if (showSpinner) setIsRefreshingJob(false);
    }
  }

  async function sendJobAction(
    jobId: string,
    action: "pause" | "resume" | "cancel",
    silent = false
  ) {
    const res = await fetch(`/api/admin/bulk-jobs/${encodeURIComponent(jobId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action }),
    });

    const data = (await safeReadJson(res)) as JobActionResponse;

    if (!res.ok || !data?.ok) {
      throw new Error(safeStr(data?.error || data?.message || `${action} failed`));
    }

    if (data?.job) {
      setCurrentJob(data.job);
    }

    if (!silent && safeStr(data?.message)) {
      setServerMessage(safeStr(data.message));
      setServerMessageType("info");
    }

    return data?.job || null;
  }

  async function runProcessingLoop(jobId: string) {
    if (!jobId) return;

    processorStopRef.current = false;
    const runId = Date.now();
    processorRunIdRef.current = runId;
    setIsProcessingJob(true);

    try {
      while (
        mountedRef.current &&
        processorRunIdRef.current === runId &&
        !processorStopRef.current
      ) {
        const res = await fetch(
          "/api/admin/products/bulk/details/jobs/process",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              jobId,
              maxSteps: PROCESS_MAX_STEPS_PER_REQUEST,
            }),
          }
        );

        const data = (await safeReadJson(res)) as ProcessJobResponse;

        if (!res.ok || !data?.ok) {
          setServerMessage(
            safeStr(data?.error || data?.message || "Job processing failed")
          );
          setServerMessageType("error");
          break;
        }

        if (data?.job) {
          setCurrentJob(data.job);
        }

        const processingState = safeStr(data?.processingState);
        const message = safeStr(data?.message);
        const finalJobStatus = safeStr(data?.job?.status);

        if (processingState === "processed") {
          await sleep(PROCESS_LOOP_DELAY_MS);
          continue;
        }

        if (processingState === "finished") {
          setServerMessage(message || "Bulk job completed.");
          setServerMessageType(
            finalJobStatus === "completed" ? "success" : "info"
          );
          break;
        }

        if (processingState === "paused") {
          setServerMessage(message || "Bulk job paused.");
          setServerMessageType("info");
          break;
        }

        if (processingState === "cancelled") {
          setServerMessage(message || "Bulk job cancelled.");
          setServerMessageType("info");
          break;
        }

        if (processingState === "failed") {
          setServerMessage(message || "Bulk job failed.");
          setServerMessageType("error");
          break;
        }

        if (message) {
          setServerMessage(message);
          setServerMessageType("info");
        }
        break;
      }
    } finally {
      if (processorRunIdRef.current === runId) {
        setIsProcessingJob(false);
      }
      await fetchCurrentJob(false);
    }
  }

  async function resumeAndProcessJob(job: BulkJob | null, silentResumeMessage = false) {
    const jobId = safeStr(job?._id);
    if (!jobId) return;

    setIsResumingJob(true);

    try {
      const resumedJob = await sendJobAction(jobId, "resume", silentResumeMessage);
      if (!silentResumeMessage) {
        setServerMessage(
          "Saved job resume ho gayi hai. Ab rows one-by-one process hongi."
        );
        setServerMessageType("info");
      }
      await runProcessingLoop(safeStr(resumedJob?._id || jobId));
    } catch (error: any) {
      setServerMessage(safeStr(error?.message || "Resume failed"));
      setServerMessageType("error");
    } finally {
      setIsResumingJob(false);
    }
  }

  async function createBulkDetailsJob() {
    if (!canSubmit) {
      alert("Category, Title Template aur CSV/Excel data required hai.");
      return;
    }

    if (form.category === PHYSICAL_CATEGORY) {
      alert(
        "Handwritten Hardcopy (Delivery) category ka manual bulk upload disabled hai. Ye products auto-generate honge."
      );
      return;
    }

    if (activeJobExists) {
      alert(
        "Ek bulk product details job already saved hai. Pehle usko resume, complete ya cancel hone do."
      );
      return;
    }

    setIsSubmittingJob(true);
    resetMessages();

    try {
      let res: Response;

      if (uploadFile) {
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("dryRun", "false");
        fd.append("category", form.category);
        fd.append("titleTemplate", form.titleTemplate);
        fd.append("importantNoteTemplate", form.importantNoteTemplate);
        fd.append("shortDescTemplate", form.shortDescTemplate);
        fd.append("longDescTemplate", form.longDescTemplate);
        fd.append("slugTemplate", form.slugTemplate);
        fd.append("metaTitleTemplate", form.metaTitleTemplate);
        fd.append("metaDescriptionTemplate", form.metaDescriptionTemplate);
        fd.append("publishNow", String(form.publishNow));
        fd.append("duplicateStrategy", form.duplicateStrategy);

        res = await fetch("/api/admin/products/bulk/details/jobs", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      } else {
        res = await fetch("/api/admin/products/bulk/details/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            dryRun: false,
            category: form.category,
            titleTemplate: form.titleTemplate,
            importantNoteTemplate: form.importantNoteTemplate,
            shortDescTemplate: form.shortDescTemplate,
            longDescTemplate: form.longDescTemplate,
            slugTemplate: form.slugTemplate,
            metaTitleTemplate: form.metaTitleTemplate,
            metaDescriptionTemplate: form.metaDescriptionTemplate,
            publishNow: form.publishNow,
            duplicateStrategy: form.duplicateStrategy,
            csvText: form.csvText,
          }),
        });
      }

      const data = (await safeReadJson(res)) as CreateJobResponse;

      if (!res.ok || !data?.ok || !data?.job) {
        throw new Error(
          safeStr(data?.error || data?.message || "Failed to create bulk job")
        );
      }

      setCurrentJob(data.job);
      setServerMessage(
        "Bulk job save ho gayi hai. Ab current session me one-by-one processing start ki ja rahi hai."
      );
      setServerMessageType("success");

      resetFileInput();
      setForm((prev) => ({ ...prev, csvText: "" }));

      await resumeAndProcessJob(data.job, true);
    } catch (error: any) {
      const errMsg = safeStr(error?.message || "Failed to create bulk job");
      setServerMessage(errMsg);
      setServerMessageType("error");
    } finally {
      setIsSubmittingJob(false);
    }
  }

  async function pauseCurrentJob() {
    const jobId = safeStr(currentJob?._id);
    if (!jobId) return;

    setIsPausingJob(true);
    resetMessages();
    processorStopRef.current = true;

    try {
      const pausedJob = await sendJobAction(jobId, "pause", true);
      setCurrentJob(pausedJob || currentJob);
      setServerMessage(
        "Pause request save ho gayi hai. Current row complete hone ke baad job ruk jayegi."
      );
      setServerMessageType("info");
    } catch (error: any) {
      setServerMessage(safeStr(error?.message || "Pause failed"));
      setServerMessageType("error");
    } finally {
      setIsPausingJob(false);
    }
  }

  async function cancelCurrentJob() {
    const jobId = safeStr(currentJob?._id);
    if (!jobId) return;

    const ok = window.confirm(
      "Kya aap current bulk product details job ko cancel karna chahte hain?"
    );
    if (!ok) return;

    setIsCancellingJob(true);
    resetMessages();
    processorStopRef.current = true;

    try {
      const cancelledJob = await sendJobAction(jobId, "cancel", true);
      setCurrentJob(cancelledJob || null);
      setServerMessage("Current bulk job cancelled.");
      setServerMessageType("info");
    } catch (error: any) {
      setServerMessage(safeStr(error?.message || "Cancel failed"));
      setServerMessageType("error");
    } finally {
      setIsCancellingJob(false);
    }
  }

  function downloadRecentFailuresCsv() {
    const rows = Array.isArray(currentJob?.recentFailures)
      ? currentJob?.recentFailures
      : [];

    if (!rows.length) {
      alert("Abhi download ke liye recent failures available nahi hain.");
      return;
    }

    const csv = buildRecentFailuresCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-product-details-recent-failures.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    mountedRef.current = true;
    loadDefaultTemplates();
    fetchCurrentJob(true);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const active =
      isSubmittingJob ||
      isCancellingJob ||
      isRefreshingJob ||
      isProcessingJob ||
      isPausingJob ||
      isResumingJob;

    if (active && !longTaskActiveRef.current) {
      notifyLongTaskStart();
      longTaskActiveRef.current = true;
    }

    if (!active && longTaskActiveRef.current) {
      notifyLongTaskEnd();
      longTaskActiveRef.current = false;
    }
  }, [
    isSubmittingJob,
    isCancellingJob,
    isRefreshingJob,
    isProcessingJob,
    isPausingJob,
    isResumingJob,
  ]);

  useEffect(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    pollTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (isProcessingJob) return;
      fetchCurrentJob(false);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isProcessingJob]);

  useEffect(() => {
    const onFocus = () => {
      if (isProcessingJob) return;
      fetchCurrentJob(false);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isProcessingJob) {
        fetchCurrentJob(false);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isProcessingJob]);

  useEffect(() => {
    return () => {
      processorStopRef.current = true;
      processorRunIdRef.current += 1;

      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      if (longTaskActiveRef.current) {
        notifyLongTaskEnd();
        longTaskActiveRef.current = false;
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">
                Bulk Product Details Upload
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Excel/CSV upload hone ke baad job database me save rahegi.
                Processing current browser session me row-by-row chalegi. Logout,
                browser close, session expire ya PC off hone par process pause ho
                jayegi. Dobara login karke Resume se wahi se continue kar sakte ho.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/admin/products/bulk/details/default-patterns"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition font-semibold shadow-sm"
              >
                <Settings2 size={18} />
                Default Details Pattern
              </Link>

              <button
                type="button"
                onClick={() => fetchCurrentJob(true)}
                disabled={isRefreshingJob}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <RefreshCcw
                  size={18}
                  className={isRefreshingJob ? "animate-spin" : ""}
                />
                Refresh Status
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

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-blue-800" />
              <div>
                <div className="text-sm font-extrabold text-blue-900">
                  Pricing aur availability dono auto-managed hain
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Manual price aur manual availability ki need nahi hai.
                  <br />
                  Final price <b>Product Pricing rules</b> se aayega.
                  <br />
                  Final availability current product file state se auto derive hoti
                  rahegi.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-extrabold text-emerald-900">
                  Sample CSV rows
                </div>
                <div className="text-sm text-emerald-800 mt-1">
                  Minimum required columns: SKU, Subject Code, Session, Language,
                  Course Code.
                </div>
              </div>
              <button
                type="button"
                onClick={fillSample}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                <FileSpreadsheet size={16} />
                Fill Sample
              </button>
            </div>

            <pre className="mt-3 overflow-auto rounded-xl bg-white border border-emerald-200 p-3 text-xs leading-6 text-slate-700">
              {SAMPLE_CSV}
            </pre>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-extrabold text-blue-900">
              CSV / Excel format
            </div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              File me required columns ye hain:{" "}
              <b>
                Unique Id, Subject Code, Session, Language, Course Code
              </b>
              .
              <br />
              {TOKEN_HELP.map((x) => (
                <div key={x}>{x}</div>
              ))}
              <div className="mt-2 font-semibold">
                Note: %F me sirf usi language ka subject title aayega jo row me
                diya gaya hai.
              </div>
            </div>
          </div>

          {serverMessage ? (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${
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

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Server size={20} />
                </div>
                <div>
                  <div className="text-sm font-extrabold">Current Job Status</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Ye status database se aa raha hai. Same saved job dusre device
                    par bhi dikh sakti hai, lekin processing tabhi chalegi jab
                    kisi device se Resume/Start kiya jayega.
                  </div>
                </div>
              </div>

              {currentJob ? (
                <div
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-extrabold ${statusPillClasses(
                    currentJobVisualStatus
                  )}`}
                >
                  <Activity size={14} />
                  {humanJobStatus(currentJobVisualStatus)}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-extrabold bg-slate-50 text-slate-700 border-slate-200">
                  <Info size={14} />
                  No job found
                </div>
              )}
            </div>

            {currentJob ? (
              <>
                <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFinalJobStatus(safeStr(currentJob.status))
                        ? safeStr(currentJob.status) === "completed"
                          ? "bg-emerald-600"
                          : safeStr(currentJob.status) === "completed_with_errors"
                          ? "bg-amber-600"
                          : "bg-rose-600"
                        : needsManualResume
                        ? "bg-amber-500"
                        : "bg-sky-600"
                    }`}
                    style={{ width: `${jobProgressPercent}%` }}
                  />
                </div>

                <div className="mt-3 text-xs text-slate-500 leading-6">
                  {needsManualResume
                    ? "Job paused/saved state me hai. Resume button dabane par wahi se continue hogi."
                    : isProcessingJob
                    ? "Is browser session me row-by-row processing chal rahi hai."
                    : !isFinalJobStatus(safeStr(currentJob.status))
                    ? "Job saved hai aur ready state me hai."
                    : "Job final state me pahunch chuki hai."}
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-slate-500">
                      Job ID
                    </div>
                    <div className="mt-2 text-sm font-bold break-all">
                      {currentJob._id}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-slate-500">
                      Progress
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      {safeNum(progress.processedItems)} /{" "}
                      {safeNum(progress.totalItems)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {jobProgressPercent}% complete
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-slate-500">
                      Last Processed Row
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      {safeNum(progress.lastProcessedIndex, -1) + 1}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Next continue yahi ke baad se hogi
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-slate-500">
                      Last heartbeat
                    </div>
                    <div className="mt-2 text-sm font-bold">
                      {formatDateTime(currentJob.lastHeartbeatAt)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-emerald-700">
                      Created
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      {safeNum(summary.createdRows)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-blue-700">
                      Updated
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      {safeNum(summary.updatedRows)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-amber-700">
                      Skipped
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      {safeNum(summary.skippedRows)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-rose-700">
                      Failed
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      {safeNum(summary.failedRows)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="text-xs uppercase tracking-wide font-extrabold text-indigo-700">
                      Validated
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      {safeNum(summary.validRows)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-extrabold">Job Meta</div>
                    <div className="mt-3 text-sm text-slate-700 leading-7">
                      Category: <b>{safeStr(summary.category || form.category || "-")}</b>
                      <br />
                      Duplicate Strategy:{" "}
                      <b>{safeStr(summary.duplicateStrategy || "-")}</b>
                      <br />
                      Dry Run: <b>{safeBool(summary.dryRun) ? "Yes" : "No"}</b>
                      <br />
                      Resume Needed: <b>{needsManualResume ? "Yes" : "No"}</b>
                      <br />
                      Started: <b>{formatDateTime(currentJob.startedAt)}</b>
                      <br />
                      Completed: <b>{formatDateTime(currentJob.completedAt)}</b>
                      <br />
                      Result: <b>{safeStr(currentJob.resultMessage || "—")}</b>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-extrabold">Last Processing Note</div>
                    <div className="mt-3 text-sm text-slate-700 leading-7">
                      Last Row Index: <b>{safeNum(progress.lastProcessedIndex, -1)}</b>
                      <br />
                      Attempted: <b>{safeNum(lastBatch?.attempted)}</b>
                      <br />
                      Success: <b>{safeNum(lastBatch?.success)}</b>
                      <br />
                      Failed: <b>{safeNum(lastBatch?.failed)}</b>
                      <br />
                      Skipped: <b>{safeNum(lastBatch?.skipped)}</b>
                      <br />
                      Started At: <b>{formatDateTime(lastBatch?.startedAt)}</b>
                      <br />
                      Ended At: <b>{formatDateTime(lastBatch?.endedAt)}</b>
                      <br />
                      Note: <b>{safeStr(lastBatch?.note || "—")}</b>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  {canResumeSavedJob ? (
                    <button
                      type="button"
                      onClick={() => resumeAndProcessJob(currentJob, false)}
                      disabled={!canResumeSavedJob}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
                    >
                      {isResumingJob || isProcessingJob ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <Play size={18} />
                      )}
                      {needsManualResume
                        ? isResumingJob || isProcessingJob
                          ? "Resuming..."
                          : "Resume Saved Job"
                        : isResumingJob || isProcessingJob
                        ? "Starting..."
                        : "Start / Continue Processing"}
                    </button>
                  ) : null}

                  {canPauseSavedJob ? (
                    <button
                      type="button"
                      onClick={pauseCurrentJob}
                      disabled={isPausingJob}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white transition font-extrabold disabled:opacity-60"
                    >
                      {isPausingJob ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <PauseCircle size={18} />
                      )}
                      {isPausingJob ? "Pausing..." : "Pause Job"}
                    </button>
                  ) : null}

                  {!isFinalJobStatus(safeStr(currentJob.status)) ? (
                    <button
                      type="button"
                      onClick={cancelCurrentJob}
                      disabled={isCancellingJob}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition font-extrabold disabled:opacity-60"
                    >
                      {isCancellingJob ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <PauseCircle size={18} />
                      )}
                      {isCancellingJob ? "Cancelling..." : "Cancel Current Job"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={downloadRecentFailuresCsv}
                    disabled={!recentFailures.length}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                  >
                    <Download size={18} />
                    Download Recent Failures CSV
                  </button>
                </div>

                {recentFailures.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-extrabold text-amber-900">
                      Recent Failures / Skips ({recentFailures.length})
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-amber-900">
                            <th className="py-2 pr-4">Row</th>
                            <th className="py-2 pr-4">SKU</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentFailures.slice(-10).map((row, idx) => (
                            <tr
                              key={`${row.rowNumber}-${row.sku}-${idx}`}
                              className="border-t border-amber-200 align-top"
                            >
                              <td className="py-2 pr-4 whitespace-nowrap">
                                {safeNum(row.rowNumber)}
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap">
                                {safeStr(row.sku || row.identifier || "-")}
                              </td>
                              <td className="py-2 pr-4 whitespace-nowrap font-semibold">
                                {safeStr(row.status || "-")}
                              </td>
                              <td className="py-2 pr-4 min-w-[320px]">
                                {safeStr(row.reason || "-")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Abhi tak koi bulk product details job nahi mili.
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="text-sm font-extrabold">
                    Static Template Details
                  </div>

                  <Link
                    href="/admin/products/bulk/details/default-patterns"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold"
                  >
                    <Settings2 size={16} />
                    Manage Default Patterns
                  </Link>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  Category
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.category}
                  onChange={(e) => applyCategoryDefaults(e.target.value)}
                  disabled={isSubmittingJob || activeJobExists}
                >
                  {allowedCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="mt-2 text-xs text-slate-500 leading-5">
                  Selected category ke saved default templates yahan auto-fill hote
                  hain. Manual changes upload se pehle ab bhi allowed hain.
                  {!defaultsHydrated ? " Default settings load ho rahi hain..." : ""}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Title Template
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.titleTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, titleTemplate: e.target.value }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Important Note Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.importantNoteTemplate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      importantNoteTemplate: e.target.value,
                    }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Short Description Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.shortDescTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shortDescTemplate: e.target.value }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Long Description Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[140px]"
                  value={form.longDescTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, longDescTemplate: e.target.value }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Slug Template (optional)
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="Leave blank for auto slug"
                  value={form.slugTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slugTemplate: e.target.value }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Title Template
                </label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.metaTitleTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, metaTitleTemplate: e.target.value }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Meta Description Template
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[110px]"
                  value={form.metaDescriptionTemplate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      metaDescriptionTemplate: e.target.value,
                    }))
                  }
                  disabled={isSubmittingJob || activeJobExists}
                />

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.publishNow}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, publishNow: e.target.checked }))
                    }
                    className="h-4 w-4"
                    disabled={isSubmittingJob || activeJobExists}
                  />
                  <div className="font-bold text-sm">
                    Publish now (otherwise draft)
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">
                  CSV / Excel Input
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  Upload CSV / Excel file
                </label>
                <input
                  id="bulk-details-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={isSubmittingJob || activeJobExists}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file) {
                      setForm((p) => ({ ...p, csvText: "" }));
                    }
                  }}
                />

                <div className="mt-2 text-xs text-slate-500">
                  Selected file: {uploadFile ? uploadFile.name : "No file selected"}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">
                  Or paste CSV text
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 outline-none min-h-[260px] font-mono text-sm"
                  placeholder={SAMPLE_CSV}
                  value={form.csvText}
                  disabled={isSubmittingJob || activeJobExists}
                  onChange={(e) => {
                    setUploadFile(null);
                    setForm((p) => ({ ...p, csvText: e.target.value }));
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">
                  Duplicate Product Handling
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="ignore"
                      checked={form.duplicateStrategy === "ignore"}
                      onChange={() =>
                        setForm((p) => ({ ...p, duplicateStrategy: "ignore" }))
                      }
                      className="mt-1 h-4 w-4"
                      disabled={isSubmittingJob || activeJobExists}
                    />
                    <div>
                      <div className="font-bold text-sm">Ignore duplicate row</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Same SKU ya same generated slug mile to old product same
                        rahega, new row skip ho jayegi.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="replace"
                      checked={form.duplicateStrategy === "replace"}
                      onChange={() =>
                        setForm((p) => ({ ...p, duplicateStrategy: "replace" }))
                      }
                      className="mt-1 h-4 w-4"
                      disabled={isSubmittingJob || activeJobExists}
                    />
                    <div>
                      <div className="font-bold text-sm">
                        Replace existing product
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Same SKU ya same generated slug mile to old product ki
                        details new uploaded data se update ho jayengi.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-800">
                  Processing row-by-row hi hogi. Lekin ab ye cron/runner se nahi,
                  current logged-in session ke Start/Resume flow se chalegi.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">Actions</div>

                <button
                  type="button"
                  disabled={!canStartNewJob}
                  onClick={createBulkDetailsJob}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
                >
                  {isSubmittingJob ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <Play size={18} />
                  )}
                  {isSubmittingJob
                    ? "Saving Job..."
                    : "Save Job & Start Processing"}
                </button>

                {canResumeSavedJob ? (
                  <button
                    type="button"
                    disabled={!canResumeSavedJob}
                    onClick={() => resumeAndProcessJob(currentJob, false)}
                    className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white transition font-extrabold disabled:opacity-60"
                  >
                    {isResumingJob || isProcessingJob ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : (
                      <Play size={18} />
                    )}
                    {needsManualResume
                      ? isResumingJob || isProcessingJob
                        ? "Resuming..."
                        : "Resume Saved Job"
                      : isResumingJob || isProcessingJob
                      ? "Starting..."
                      : "Start / Continue Saved Job"}
                  </button>
                ) : null}

                {canPauseSavedJob ? (
                  <button
                    type="button"
                    disabled={isPausingJob}
                    onClick={pauseCurrentJob}
                    className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white transition font-extrabold disabled:opacity-60"
                  >
                    {isPausingJob ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : (
                      <PauseCircle size={18} />
                    )}
                    {isPausingJob ? "Pausing..." : "Pause Job"}
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={isSubmittingJob || activeJobExists}
                  onClick={() => {
                    resetFileInput();
                    resetMessages();
                    resetFormToCurrentCategoryDefaults();
                  }}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                >
                  <RefreshCcw size={18} />
                  Reset Form
                </button>

                <div className="mt-4 text-[11px] text-slate-500 leading-5">
                  New job save karne ke baad aap page close, logout ya device change
                  kar sakte ho. Progress save rahegi, lekin processing pause ho
                  jayegi. Baad me Resume se wahi se continue kar sakte ho.
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="inline-flex items-center gap-2 text-sm font-extrabold text-amber-900">
                  <AlertTriangle size={16} />
                  Important
                </div>
                <div className="text-sm text-amber-800 mt-2 leading-6">
                  Subject code master subjects me hona chahiye.
                  <br />
                  Course code master courses me hona chahiye.
                  <br />
                  Multiple course codes comma separated allowed hain.
                  <br />
                  Session selected category ke master sessions me valid hona chahiye.
                  <br />
                  Failed ya skipped rows current job report me dikhengi.
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-900">
                  <Database size={16} />
                  Current progress summary
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Total Entries: <b>{safeNum(progress.totalItems)}</b>
                  <br />
                  Processed Entries: <b>{safeNum(progress.processedItems)}</b>
                  <br />
                  Success Entries: <b>{safeNum(progress.successItems)}</b>
                  <br />
                  Skipped Entries: <b>{safeNum(progress.skippedItems)}</b>
                  <br />
                  Failed Entries: <b>{safeNum(progress.failedItems)}</b>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="inline-flex items-center gap-2 text-sm font-extrabold text-sky-900">
                  <FileUp size={16} />
                  New flow
                </div>
                <div className="text-sm text-sky-800 mt-2 leading-6">
                  Step 1: Excel/CSV upload/save
                  <br />
                  Step 2: Job database me create
                  <br />
                  Step 3: Start/Resume dabane par current session me row-by-row process
                  <br />
                  Step 4: Logout / close par pause
                  <br />
                  Step 5: Dobara login karke Resume
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}