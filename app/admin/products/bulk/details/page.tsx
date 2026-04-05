"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
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
} from "lucide-react";
import { CATEGORY_CONFIG, PHYSICAL_CATEGORY } from "@/lib/productCatalog";

type PreparedBulkDetailsRow = {
  rowNumber: number;
  A: string; // unique_id / sku
  B: string; // subject_code
  C: string; // session
  D: string; // language
  E: string; // course_code
};

type DirectFailureRow = {
  itemIndex?: number;
  rowNumber?: number;
  batchNumber?: number;
  identifier?: string;
  sku?: string;
  status?: string;
  reason?: string;
  raw?: any;
};

type DirectUploadResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  summary?: {
    totalRows?: number;
    validRows?: number;
    createdRows?: number;
    updatedRows?: number;
    skippedRows?: number;
    failedRows?: number;
    processedRows?: number;
    doneRows?: number;
    duplicateStrategy?: string;
    dryRun?: boolean;
    category?: string;
    comboSync?: any;
    hardcopySync?: any;
  };
  failuresCount?: number;
  failures?: DirectFailureRow[];
  failureCsv?: string;
};

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

const DIRECT_UPLOAD_CONCURRENCY = 1;
const REQUEST_TIMEOUT_MS = 120000;

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

function csvCell(input: any) {
  const raw = safeStr(input).replace(/\r?\n/g, " ");
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildFailureCsv(rows: DirectFailureRow[]) {
  const header = [
    "Row Number",
    "Unique Id",
    "Subject Code",
    "Session",
    "Language",
    "Course Code",
    "Status",
    "Reason",
  ];

  const body = rows.map((row) => {
    const raw = row?.raw || {};
    return [
      csvCell(row?.rowNumber),
      csvCell(raw?.unique_id || raw?.A || ""),
      csvCell(raw?.subject_code || raw?.B || ""),
      csvCell(raw?.session || raw?.C || ""),
      csvCell(raw?.language || raw?.D || ""),
      csvCell(raw?.course_code || raw?.E || ""),
      csvCell(row?.status || ""),
      csvCell(row?.reason || ""),
    ].join(",");
  });

  return [header.map(csvCell).join(","), ...body].join("\n");
}

function rowLooksLikeHeader(row: string[]) {
  const joined = row.map((x) => safeStr(x).toLowerCase()).join(",");
  return (
    joined.includes("unique_id") ||
    joined.includes("subject_code") ||
    joined.includes("session") ||
    joined.includes("language") ||
    joined.includes("course_code")
  );
}

function parseCsv(text: string) {
  const cleaned = String(text ?? "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .map((r) => r.map((c) => safeStr(c)))
    .filter((r) => r.some((c) => c !== ""));
}

function prepareBulkDetailsRows(csvText: string) {
  let parsedRows = parseCsv(csvText);

  if (!parsedRows.length) {
    throw new Error("CSV empty hai");
  }

  const hasHeader = parsedRows.length > 0 && rowLooksLikeHeader(parsedRows[0]);
  if (hasHeader) {
    parsedRows = parsedRows.slice(1);
  }

  return parsedRows.map((raw, i) => {
    const cols = [...raw];
    while (cols.length < 5) cols.push("");

    return {
      rowNumber: hasHeader ? i + 2 : i + 1,
      A: safeStr(cols[0]),
      B: safeStr(cols[1]),
      C: safeStr(cols[2]),
      D: safeStr(cols[3]),
      E: safeStr(cols[4]),
    } as PreparedBulkDetailsRow;
  });
}

function buildFailureFromRow(
  row: PreparedBulkDetailsRow,
  status: string,
  reason: string
): DirectFailureRow {
  return {
    rowNumber: row.rowNumber,
    identifier: safeStr(row.A),
    sku: safeStr(row.A),
    status,
    reason,
    raw: {
      unique_id: safeStr(row.A),
      subject_code: safeStr(row.B),
      session: safeStr(row.C),
      language: safeStr(row.D),
      course_code: safeStr(row.E),
      A: safeStr(row.A),
      B: safeStr(row.B),
      C: safeStr(row.C),
      D: safeStr(row.D),
      E: safeStr(row.E),
    },
  };
}

async function readRowsFromFile(file: File) {
  const lowerName = safeStr(file.name).toLowerCase();

  if (lowerName.endsWith(".csv")) {
    const text = await file.text();
    return prepareBulkDetailsRows(text);
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames?.[0];

    if (!firstSheetName) {
      throw new Error("Excel sheet not found");
    }

    const sheet = workbook.Sheets[firstSheetName];
    const csvText = XLSX.utils.sheet_to_csv(sheet);
    return prepareBulkDetailsRows(csvText);
  }

  throw new Error("Only CSV or Excel allowed");
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return { ok: false, error: "Server returned empty response" };

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: text.slice(0, 400) || "Invalid server response",
    };
  }
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

  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [serverMessage, setServerMessage] = useState("");
  const [serverMessageType, setServerMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [isUploading, setIsUploading] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [defaultsHydrated, setDefaultsHydrated] = useState(false);

  const [totalEntries, setTotalEntries] = useState(0);
  const [uploadedEntries, setUploadedEntries] = useState(0);
  const [processedEntries, setProcessedEntries] = useState(0);
  const [skippedEntries, setSkippedEntries] = useState(0);
  const [failedEntries, setFailedEntries] = useState(0);

  const [failureRows, setFailureRows] = useState<DirectFailureRow[]>([]);
  const [defaultTemplateMap, setDefaultTemplateMap] =
    useState<Record<string, DefaultTemplateItem>>(fallbackTemplateMap);

  const stopRequestedRef = useRef(false);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const longTaskActiveRef = useRef(false);

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
      const res = await fetch("/api/admin/products/bulk/details/default-templates", {
        credentials: "include",
        cache: "no-store",
      });

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

  const canSubmit = useMemo(() => {
    return (
      form.category.trim() &&
      form.titleTemplate.trim() &&
      (form.csvText.trim() || uploadFile)
    );
  }, [form, uploadFile]);

  const uploadedPercent = useMemo(() => {
    if (!totalEntries) return 0;
    return Math.min(100, Math.round((uploadedEntries / totalEntries) * 100));
  }, [uploadedEntries, totalEntries]);

  function fillSample() {
    setForm((p) => ({ ...p, csvText: SAMPLE_CSV }));
    setUploadFile(null);
    setServerMessage("");
  }

  function resetMessages() {
    setServerMessage("");
    setServerMessageType("info");
  }

  function resetProgress() {
    setTotalEntries(0);
    setUploadedEntries(0);
    setProcessedEntries(0);
    setSkippedEntries(0);
    setFailedEntries(0);
    setFailureRows([]);
  }

  function resetFileInput() {
    setUploadFile(null);
    const input = document.getElementById(
      "bulk-details-file-input"
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function downloadFailedCsv() {
    if (!failureRows.length) {
      alert("No failed/skipped rows available.");
      return;
    }

    const csv = buildFailureCsv(failureRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-product-details-failed-rows.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function uploadSingleRow(row: PreparedBulkDetailsRow) {
    const controller = new AbortController();
    activeControllersRef.current.add(controller);

    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/admin/products/bulk/details/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
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
          rows: [row],
        }),
      });

      const data = (await safeReadJson(res)) as DirectUploadResponse;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Row upload failed");
      }

      return data;
    } finally {
      clearTimeout(timeout);
      activeControllersRef.current.delete(controller);
    }
  }

  async function startDirectUpload() {
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

    setIsUploading(true);
    setIsStopping(false);
    stopRequestedRef.current = false;
    resetMessages();
    resetProgress();

    try {
      let parsedRows: PreparedBulkDetailsRow[] = [];

      if (uploadFile) {
        parsedRows = await readRowsFromFile(uploadFile);
      } else {
        parsedRows = prepareBulkDetailsRows(form.csvText);
      }

      if (!parsedRows.length) {
        throw new Error("No valid rows found");
      }

      const seenSku = new Set<string>();
      const uploadQueue: PreparedBulkDetailsRow[] = [];
      const initialFailures: DirectFailureRow[] = [];

      for (const row of parsedRows) {
        const sku = safeStr(row.A).toUpperCase();
        if (!sku) {
          initialFailures.push(
            buildFailureFromRow(row, "failed", "Unique Id / SKU missing")
          );
          continue;
        }

        if (seenSku.has(sku)) {
          initialFailures.push(
            buildFailureFromRow(
              row,
              "skipped",
              "Duplicate SKU repeated inside same upload. Only first occurrence processed."
            )
          );
          continue;
        }

        seenSku.add(sku);
        uploadQueue.push(row);
      }

      setTotalEntries(parsedRows.length);
      setSkippedEntries(
        initialFailures.filter((x) => safeStr(x.status) === "skipped").length
      );
      setFailedEntries(
        initialFailures.filter((x) => safeStr(x.status) === "failed").length
      );
      setProcessedEntries(initialFailures.length);
      setFailureRows(initialFailures);

      let nextIndex = 0;
      let createdOrUpdated = 0;
      let failedCount = initialFailures.filter(
        (x) => safeStr(x.status) === "failed"
      ).length;
      let skippedCount = initialFailures.filter(
        (x) => safeStr(x.status) === "skipped"
      ).length;
      let processedCount = initialFailures.length;
      const collectedFailures = [...initialFailures];

      async function worker() {
        while (true) {
          if (stopRequestedRef.current) return;

          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= uploadQueue.length) {
            return;
          }

          const row = uploadQueue[currentIndex];

          try {
            const data = await uploadSingleRow(row);

            const doneRows =
              safeNum(data?.summary?.createdRows, 0) +
              safeNum(data?.summary?.updatedRows, 0);
            const skippedRows = safeNum(data?.summary?.skippedRows, 0);
            const failedRowsCount = safeNum(data?.summary?.failedRows, 0);
            const serverFailures = Array.isArray(data?.failures) ? data.failures : [];

            createdOrUpdated += doneRows;
            skippedCount += skippedRows;
            failedCount += failedRowsCount;
            processedCount += 1;

            if (serverFailures.length) {
              collectedFailures.push(...serverFailures);
              setFailureRows([...collectedFailures]);
            }

            setUploadedEntries(createdOrUpdated);
            setSkippedEntries(skippedCount);
            setFailedEntries(failedCount);
            setProcessedEntries(processedCount);
          } catch (error: any) {
            const reason = safeStr(error?.message || "Row upload failed");
            const fallbackFailure = buildFailureFromRow(row, "failed", reason);

            collectedFailures.push(fallbackFailure);
            failedCount += 1;
            processedCount += 1;

            setFailureRows([...collectedFailures]);
            setFailedEntries(failedCount);
            setProcessedEntries(processedCount);
          }
        }
      }

      const workers = Array.from(
        { length: Math.max(1, DIRECT_UPLOAD_CONCURRENCY) },
        () => worker()
      );

      await Promise.all(workers);

      if (stopRequestedRef.current) {
        setServerMessage(
          `Upload stopped. Uploaded ${createdOrUpdated}/${parsedRows.length} entries. Skipped ${skippedCount}, Failed ${failedCount}.`
        );
        setServerMessageType("info");
        return;
      }

      if (createdOrUpdated > 0 && failedCount === 0 && skippedCount === 0) {
        setServerMessage(
          `${createdOrUpdated} entries successfully upload ho gayi.`
        );
        setServerMessageType("success");
      } else if (createdOrUpdated > 0) {
        setServerMessage(
          `Upload complete. Uploaded ${createdOrUpdated}/${parsedRows.length}. Skipped ${skippedCount}, Failed ${failedCount}.`
        );
        setServerMessageType("info");
      } else {
        setServerMessage(
          `Koi bhi entry successfully upload nahi ho paayi. Skipped ${skippedCount}, Failed ${failedCount}.`
        );
        setServerMessageType("error");
      }
    } catch (error: any) {
      const errMsg = safeStr(error?.message || "Direct upload failed");
      setServerMessage(errMsg);
      setServerMessageType("error");
    } finally {
      setIsUploading(false);
      setIsStopping(false);
    }
  }

  function stopCurrentUpload() {
    if (!isUploading) return;

    stopRequestedRef.current = true;
    setIsStopping(true);

    for (const controller of activeControllersRef.current) {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }

    activeControllersRef.current.clear();
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

  useEffect(() => {
    loadDefaultTemplates();
  }, []);

  useEffect(() => {
    if (isUploading && !longTaskActiveRef.current) {
      notifyLongTaskStart();
      longTaskActiveRef.current = true;
    }

    if (!isUploading && longTaskActiveRef.current) {
      notifyLongTaskEnd();
      longTaskActiveRef.current = false;
    }
  }, [isUploading]);

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;

      for (const controller of activeControllersRef.current) {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }

      activeControllersRef.current.clear();

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
              <h1 className="text-2xl font-extrabold">Bulk Product Details Upload</h1>
              <p className="text-sm text-slate-600 mt-1">
                Ab ye page simple direct upload flow par kaam karega. Har row direct final
                create/update hogi. Uploaded count me sirf wahi entries aayengi jo actual me
                save ho chuki hongi.
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
                  Final availability current product file state se auto derive hoti rahegi.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-extrabold text-emerald-900">Sample CSV rows</div>
                <div className="text-sm text-emerald-800 mt-1">
                  Minimum required columns: SKU, Subject Code, Session, Language, Course Code.
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
            <div className="text-sm font-extrabold text-blue-900">CSV / Excel format</div>
            <div className="text-sm text-blue-800 mt-2 leading-6">
              File me required columns ye hain: <b>Unique Id, Subject Code, Session, Language, Course Code</b>.
              <br />
              {TOKEN_HELP.map((x) => (
                <div key={x}>{x}</div>
              ))}
              <div className="mt-2 font-semibold">
                Note: %F me sirf usi language ka subject title aayega jo row me diya gaya hai.
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

          {isUploading ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <LoaderCircle size={18} className="animate-spin" />
                Direct bulk details upload chal raha hai.
              </div>

              <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-600 transition-all"
                  style={{ width: `${uploadedPercent}%` }}
                />
              </div>

              <div className="mt-3 text-sm text-amber-900 leading-7">
                Total Entries: <b>{totalEntries}</b>
                <br />
                Uploaded Entries: <b>{uploadedEntries}</b>
              </div>

              <div className="mt-2 text-xs text-amber-800 leading-6">
                Processed: <b>{processedEntries}</b> / <b>{totalEntries}</b>
                <br />
                Skipped: <b>{skippedEntries}</b> | Failed: <b>{failedEntries}</b>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="text-sm font-extrabold">Static Template Details</div>

                  <Link
                    href="/admin/products/bulk/details/default-patterns"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-bold"
                  >
                    <Settings2 size={16} />
                    Manage Default Patterns
                  </Link>
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Category</label>
                <select
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.category}
                  onChange={(e) => applyCategoryDefaults(e.target.value)}
                  disabled={isUploading}
                >
                  {allowedCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <div className="mt-2 text-xs text-slate-500 leading-5">
                  Selected category ke saved default templates yahan auto-fill hote hain.
                  Manual changes upload se pehle ab bhi allowed hain.
                  {!defaultsHydrated ? " Default settings load ho rahi hain..." : ""}
                </div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Title Template</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.titleTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, titleTemplate: e.target.value }))}
                  disabled={isUploading}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Important Note Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.importantNoteTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, importantNoteTemplate: e.target.value }))
                  }
                  disabled={isUploading}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Short Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[90px]"
                  value={form.shortDescTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shortDescTemplate: e.target.value }))
                  }
                  disabled={isUploading}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Long Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[140px]"
                  value={form.longDescTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, longDescTemplate: e.target.value }))
                  }
                  disabled={isUploading}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Slug Template (optional)</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="Leave blank for auto slug"
                  value={form.slugTemplate}
                  onChange={(e) => setForm((p) => ({ ...p, slugTemplate: e.target.value }))}
                  disabled={isUploading}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Meta Title Template</label>
                <input
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  value={form.metaTitleTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, metaTitleTemplate: e.target.value }))
                  }
                  disabled={isUploading}
                />

                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mt-4 block">Meta Description Template</label>
                <textarea
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[110px]"
                  value={form.metaDescriptionTemplate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, metaDescriptionTemplate: e.target.value }))
                  }
                  disabled={isUploading}
                />

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.publishNow}
                    onChange={(e) => setForm((p) => ({ ...p, publishNow: e.target.checked }))}
                    className="h-4 w-4"
                    disabled={isUploading}
                  />
                  <div className="font-bold text-sm">Publish now (otherwise draft)</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">CSV / Excel Input</div>

                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                  Upload CSV / Excel file
                </label>
                <input
                  id="bulk-details-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none"
                  disabled={isUploading}
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
                  disabled={isUploading}
                  onChange={(e) => {
                    setUploadFile(null);
                    setForm((p) => ({ ...p, csvText: e.target.value }));
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">Duplicate Product Handling</div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="ignore"
                      checked={form.duplicateStrategy === "ignore"}
                      onChange={() => setForm((p) => ({ ...p, duplicateStrategy: "ignore" }))}
                      className="mt-1 h-4 w-4"
                      disabled={isUploading}
                    />
                    <div>
                      <div className="font-bold text-sm">Ignore duplicate row</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Same SKU ya same generated slug mile to old product same rahega, new row skip ho jayegi.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="replace"
                      checked={form.duplicateStrategy === "replace"}
                      onChange={() => setForm((p) => ({ ...p, duplicateStrategy: "replace" }))}
                      className="mt-1 h-4 w-4"
                      disabled={isUploading}
                    />
                    <div>
                      <div className="font-bold text-sm">Replace existing product</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Same SKU ya same generated slug mile to old product ki details new uploaded data se update ho jayengi.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-extrabold mb-3">Actions</div>

                <button
                  type="button"
                  disabled={isUploading || !canSubmit}
                  onClick={startDirectUpload}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-950 text-white transition font-extrabold disabled:opacity-60"
                >
                  <Play size={18} />
                  {isUploading ? "Uploading..." : "Start Direct Upload"}
                </button>

                {isUploading ? (
                  <button
                    type="button"
                    onClick={stopCurrentUpload}
                    className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition font-extrabold"
                  >
                    <PauseCircle size={18} />
                    {isStopping ? "Stopping..." : "Stop Upload"}
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={isUploading || !failureRows.length}
                  onClick={downloadFailedCsv}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                >
                  <Download size={18} />
                  Download Failed / Skipped CSV
                </button>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    resetFileInput();
                    resetMessages();
                    resetProgress();
                    resetFormToCurrentCategoryDefaults();
                  }}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 transition font-extrabold disabled:opacity-60"
                >
                  <RefreshCcw size={18} />
                  Reset Form
                </button>

                <div className="mt-4 text-[11px] text-slate-500 leading-5">
                  Is direct flow me uploaded count me sirf actual saved rows hi count hongi.
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
                  Failed ya skipped rows ki list CSV me download ho sakti hai.
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="inline-flex items-center gap-2 text-sm font-extrabold text-blue-900">
                  <Database size={16} />
                  Current progress summary
                </div>
                <div className="text-sm text-blue-800 mt-2 leading-6">
                  Total Entries: <b>{totalEntries}</b>
                  <br />
                  Uploaded Entries: <b>{uploadedEntries}</b>
                  <br />
                  Skipped Entries: <b>{skippedEntries}</b>
                  <br />
                  Failed Entries: <b>{failedEntries}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}