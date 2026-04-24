import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import Product from "@/models/Product";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { syncAllGeneratedCombos } from "@/lib/comboAutoSync";
import { backfillGeneratedHardcopies } from "@/lib/hardcopyAutoSync";
import { syncProductAvailabilityBySku } from "@/lib/productAvailability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type TaskStatus =
  | "idle"
  | "pending"
  | "needs_attention"
  | "running"
  | "completed"
  | "disabled";

type RecentEventLevel = "info" | "success" | "warning" | "error";
type AutoMode = "auto" | "manual" | "hybrid";

type SyncTaskKey =
  | "availability"
  | "combo"
  | "hardcopy"
  | "fullSync"
  | "availabilityRuleAll"
  | "availabilityRuleWantToBuy";

type PublicTaskKey =
  | "availability-sync"
  | "combo-sync"
  | "hardcopy-sync"
  | "run-all-post-syncs"
  | "bulk-upload-reminder"
  | "availability-rule-sync-all-products"
  | "availability-rule-sync-want-to-buy-only"
  | "auto-run";

type NotificationTaskAction = {
  key: string;
  label: string;
  intent?: "primary" | "secondary" | "danger";
};

type NotificationTaskStat = {
  label: string;
  value: string | number;
};

type NotificationTask = {
  key: string;
  title: string;
  description: string;
  sectionKey: string;
  status: TaskStatus;
  pendingCount?: number;
  autoMode?: AutoMode;
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

type NotificationsPayload = {
  ok: boolean;
  source: "live";
  autoRefreshSeconds: number;
  sections: NotificationSection[];
  recentEvents: RecentEvent[];
  summary: {
    totalTasks: number;
    pendingTasks: number;
    runningTasks: number;
    needsAttentionTasks: number;
  };
};

type RecentEvent = {
  id: string;
  level: RecentEventLevel;
  title: string;
  message: string;
  createdAt: string;
};

type PostSyncTaskState = {
  status?: TaskStatus;
  desiredMode?: AutoMode;
  requestedAt?: string | null;
  requestedBy?: string;
  lastStartedAt?: string | null;
  lastCompletedAt?: string | null;
  lastMessage?: string;
  nextCursor?: number;
  nextSkip?: number;
  nextAfterId?: string;
  sourceJobCompletedAt?: string | null;
  stats?: Record<string, any>;
};

type PostUploadSyncState = {
  availability?: PostSyncTaskState;
  combo?: PostSyncTaskState;
  hardcopy?: PostSyncTaskState;
  fullSync?: PostSyncTaskState;
  availabilityRuleAll?: PostSyncTaskState;
  availabilityRuleWantToBuy?: PostSyncTaskState;
  recentEvents?: RecentEvent[];
};

type AccessResult =
  | {
      ok: true;
      mode: "admin" | "cron";
      actor: string;
    }
  | {
      ok: false;
      res: NextResponse;
    };

type RunBudgetOptions = {
  startedAtMs?: number;
  timeBudgetMs?: number;
  runUntilComplete?: boolean;
};

type AvailabilityRuleScope = "all" | "want_to_buy";

const PRODUCT_DETAILS_JOB_TYPE = "product_details";
const AVAILABILITY_BATCH_SIZE = 250;
const AVAILABILITY_RULE_BATCH_SIZE = 250;
const HARDCOPY_BATCH_SIZE = 200;
const MAX_RECENT_EVENTS = 20;
const FAST_AUTO_REFRESH_SECONDS = 5;
const NORMAL_AUTO_REFRESH_SECONDS = 30;
const PROGRESS_SAVE_EVERY = 10;
const DEFAULT_RUN_TIME_BUDGET_MS = 240_000;

const GENERIC_COMBO_CATEGORY_SLUGS = [
  "solved-assignments",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
];

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function safeBool(x: any, def = false) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return def;
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const v of arr) {
    const s = safeStr(v);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

function normalizeCategory(input: any) {
  return safeStr(input).toLowerCase().replace(/\s+/g, " ").trim();
}

function isSolvedAssignmentsCategory(input: any) {
  const c = normalizeCategory(input);
  return c === "solved assignments" || c === "solved-assignments";
}

function createEvent(
  level: RecentEventLevel,
  title: string,
  message: string
): RecentEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    level,
    title: safeStr(title),
    message: safeStr(message),
    createdAt: new Date().toISOString(),
  };
}

function getJobCompletionTimestamp(job: any) {
  return safeStr(job?.completedAt || job?.updatedAt || "");
}

function getJobCategory(job: any) {
  return (
    safeStr(job?.summary?.category) ||
    safeStr(job?.config?.category) ||
    safeStr(job?.meta?.category)
  );
}

function getPostUploadSyncState(job: any): PostUploadSyncState {
  const state = job?.summary?.postUploadSync;
  if (state && typeof state === "object" && !Array.isArray(state)) {
    return state as PostUploadSyncState;
  }
  return {};
}

function getSyncTaskState(
  state: PostUploadSyncState,
  key: SyncTaskKey
): PostSyncTaskState {
  const value = state?.[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PostSyncTaskState;
  }
  return {};
}

function getTaskStatsObject(taskState?: PostSyncTaskState | null) {
  const stats = taskState?.stats;
  if (stats && typeof stats === "object" && !Array.isArray(stats)) {
    return stats as Record<string, any>;
  }
  return {};
}

function computePercent(processed: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

function formatProgressValue(processed: number, total: number) {
  if (total <= 0) return "—";
  return `${processed}/${total} (${computePercent(processed, total)}%)`;
}

function extractSkuListFromJob(job: any) {
  const rows = Array.isArray(job?.input?.rows) ? job.input.rows : [];
  return uniqueStrings(
    rows
      .map((row: any) => safeStr(row?.A || row?.unique_id || row?.sku))
      .filter(Boolean)
  );
}

function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function getRunBudgetMs(options?: RunBudgetOptions) {
  const budget = safeNum(options?.timeBudgetMs, DEFAULT_RUN_TIME_BUDGET_MS);
  return Math.max(10_000, budget);
}

function hasTimeBudgetRemaining(startedAtMs: number, timeBudgetMs: number) {
  return Date.now() - startedAtMs < timeBudgetMs;
}

async function assertNotificationsAccess(req: NextRequest): Promise<AccessResult> {
  if (isCronAuthorized(req)) {
    return {
      ok: true,
      mode: "cron",
      actor: "system-cron",
    };
  }

  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    mode: "admin",
    actor: safeStr(user.email || "admin"),
  };
}

async function getLatestActiveProductDetailsJob() {
  await dbConnect();

  const doc: any = await BulkUploadJob.findOne({
    jobType: PRODUCT_DETAILS_JOB_TYPE,
    status: { $in: ["queued", "running", "processing_batch"] },
  }).sort({ createdAt: -1, _id: -1 });

  return doc || null;
}

async function getLatestCompletedProductDetailsJob() {
  await dbConnect();

  const doc: any = await BulkUploadJob.findOne({
    jobType: PRODUCT_DETAILS_JOB_TYPE,
    status: { $in: ["completed", "completed_with_errors"] },
  }).sort({ completedAt: -1, updatedAt: -1, _id: -1 });

  return doc || null;
}

async function mutateLatestCompletedJobPostSync(
  updater: (job: any, state: PostUploadSyncState) => void
) {
  await dbConnect();

  const job: any = await getLatestCompletedProductDetailsJob();
  if (!job) return null;

  const summary =
    job.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
      ? { ...job.summary }
      : {};

  const state = getPostUploadSyncState(job);
  const nextState: PostUploadSyncState = {
    ...state,
    recentEvents: Array.isArray(state?.recentEvents) ? [...state.recentEvents] : [],
  };

  updater(job, nextState);

  summary.postUploadSync = nextState;
  job.summary = summary;
  job.markModified("summary");

  await job.save();
  return job;
}

function pushRecentEvent(state: PostUploadSyncState, event: RecentEvent) {
  const list = Array.isArray(state.recentEvents) ? [...state.recentEvents] : [];
  list.unshift(event);
  state.recentEvents = list.slice(0, MAX_RECENT_EVENTS);
}

function computeTaskStatus(args: {
  explicitState?: PostSyncTaskState;
  latestCompletedJob: any;
  activeUploadJob: any;
  relevant?: boolean;
}): TaskStatus {
  const { explicitState, latestCompletedJob, activeUploadJob } = args;
  const relevant = args.relevant !== false;

  if (!relevant) return "disabled";

  if (safeStr(explicitState?.status) === "running") {
    return "running";
  }

  if (safeStr(explicitState?.status) === "needs_attention") {
    return "needs_attention";
  }

  if (!latestCompletedJob) {
    return activeUploadJob ? "disabled" : "idle";
  }

  const latestCompletedAt = getJobCompletionTimestamp(latestCompletedJob);
  const lastCompletedAt = safeStr(explicitState?.lastCompletedAt);

  if (lastCompletedAt && latestCompletedAt && lastCompletedAt >= latestCompletedAt) {
    return "completed";
  }

  if (activeUploadJob) {
    return "disabled";
  }

  return "pending";
}

function computeStandaloneTaskStatus(args: {
  explicitState?: PostSyncTaskState;
  activeUploadJob: any;
}): TaskStatus {
  const explicitState = args.explicitState;
  const status = safeStr(explicitState?.status);

  if (status === "running") return "running";
  if (status === "needs_attention") return "needs_attention";

  if (args.activeUploadJob) return "disabled";

  const nextAfterId = safeStr((explicitState as any)?.nextAfterId);
  if (status === "pending" || nextAfterId) return "pending";

  if (safeStr(explicitState?.lastCompletedAt)) return "completed";

  return "idle";
}

function buildRecentEventsFromJob(args: {
  latestCompletedJob: any;
  activeUploadJob: any;
}) {
  const { latestCompletedJob, activeUploadJob } = args;
  const fromJobState = getPostUploadSyncState(latestCompletedJob);
  const events = Array.isArray(fromJobState?.recentEvents)
    ? [...fromJobState.recentEvents]
    : [];

  if (activeUploadJob) {
    events.unshift(
      createEvent(
        "info",
        "Bulk upload active",
        `Current product details upload job is ${safeStr(
          activeUploadJob?.status
        )}. Post-upload sync buttons upload complete hone ke baad best rehenge.`
      )
    );
  }

  if (latestCompletedJob) {
    const totalRows = safeNum(latestCompletedJob?.summary?.totalRows, 0);
    const completedAt = getJobCompletionTimestamp(latestCompletedJob);
    events.unshift(
      createEvent(
        "success",
        "Latest bulk upload found",
        `${totalRows} row wali latest product details job ${
          completedAt ? `completed at ${completedAt}` : "is available"
        }.`
      )
    );
  }

  return events.slice(0, MAX_RECENT_EVENTS);
}

function buildAvailabilityStats(args: {
  latestCompletedJob: any;
  latestSkuList: string[];
  taskState: PostSyncTaskState;
}) {
  const taskStats = getTaskStatsObject(args.taskState);
  const total = Math.max(
    safeNum(taskStats.totalSourceSkus, 0),
    args.latestSkuList.length
  );
  const processed = safeNum(taskStats.processed, 0);
  const synced = safeNum(taskStats.synced, 0);
  const failed = safeNum(taskStats.failed, 0);
  const nextCursor = safeNum(args.taskState.nextCursor, 0);

  return [
    { label: "Target SKUs", value: total || args.latestSkuList.length },
    { label: "Progress", value: formatProgressValue(processed, total) },
    { label: "Synced", value: synced },
    { label: "Failed", value: failed },
    { label: "Next Cursor", value: nextCursor },
    {
      label: "Batch Size",
      value: safeNum(taskStats.batchSize, AVAILABILITY_BATCH_SIZE),
    },
  ] as NotificationTaskStat[];
}

function buildComboStats(taskState: PostSyncTaskState) {
  const taskStats = getTaskStatsObject(taskState);
  const totalPhases = safeNum(taskStats.totalPhases, 0);
  const processedPhases = safeNum(taskStats.processedPhases, 0);
  const resultBuckets = safeNum(taskStats.resultBuckets, 0);

  return [
    { label: "Phases", value: formatProgressValue(processedPhases, totalPhases) },
    { label: "Result Buckets", value: resultBuckets },
    { label: "Include PYQ", value: safeBool(taskStats.includePyq, true) ? "Yes" : "No" },
    {
      label: "Include Generic",
      value: safeBool(taskStats.includeGeneric, true) ? "Yes" : "No",
    },
    {
      label: "Current Phase",
      value: safeStr(taskStats.currentPhaseLabel || "—"),
    },
  ] as NotificationTaskStat[];
}

function buildHardcopyStats(taskState: PostSyncTaskState) {
  const taskStats = getTaskStatsObject(taskState);
  const totalEligibleSources = safeNum(taskStats.totalEligibleSources, 0);
  const processed = safeNum(taskStats.processed, 0);
  const created = safeNum(taskStats.created, 0);
  const updated = safeNum(taskStats.updated, 0);
  const failed = safeNum(taskStats.failed, 0);
  const nextSkip = safeNum(taskState.nextSkip, 0);

  return [
    { label: "Eligible Sources", value: totalEligibleSources || "—" },
    { label: "Progress", value: formatProgressValue(processed, totalEligibleSources) },
    { label: "Created", value: created },
    { label: "Updated", value: updated },
    { label: "Failed", value: failed },
    { label: "Next Skip", value: nextSkip },
  ] as NotificationTaskStat[];
}

function buildFullSyncStats(args: {
  latestCategory: string;
  hardcopyRelevant: boolean;
  taskState: PostSyncTaskState;
}) {
  const taskStats = getTaskStatsObject(args.taskState);
  const totalPhases = safeNum(taskStats.totalPhases, 0);
  const processedPhases = safeNum(taskStats.processedPhases, 0);

  return [
    {
      label: "Includes",
      value: args.hardcopyRelevant ? "3 tasks" : "2 tasks",
    },
    { label: "Latest Category", value: args.latestCategory || "—" },
    { label: "Progress", value: formatProgressValue(processedPhases, totalPhases) },
    {
      label: "Current Phase",
      value: safeStr(taskStats.currentPhaseLabel || "—"),
    },
    {
      label: "Has More Work",
      value: safeBool(taskStats.hasMoreWork, false) ? "Yes" : "No",
    },
  ] as NotificationTaskStat[];
}

function buildAvailabilityRuleStats(args: {
  taskState: PostSyncTaskState;
  totalFallback: number;
  scopeLabel: string;
}) {
  const taskStats = getTaskStatsObject(args.taskState);
  const total = Math.max(safeNum(taskStats.totalSourceProducts, 0), args.totalFallback);
  const processed = safeNum(taskStats.processed, 0);
  const synced = safeNum(taskStats.synced, 0);
  const failed = safeNum(taskStats.failed, 0);
  const available = safeNum(taskStats.availableCount, 0);
  const onDemand = safeNum(taskStats.onDemandCount, 0);
  const wantToBuy = safeNum(taskStats.wantToBuyCount, 0);
  const nextAfterId = safeStr((args.taskState as any)?.nextAfterId || "");

  return [
    { label: "Scope", value: args.scopeLabel },
    { label: "Target Products", value: total || args.totalFallback || 0 },
    { label: "Progress", value: formatProgressValue(processed, total) },
    { label: "Synced", value: synced },
    { label: "Failed", value: failed },
    { label: "Available", value: available },
    { label: "On Demand", value: onDemand },
    { label: "Want to Buy", value: wantToBuy },
    { label: "Resume Cursor", value: nextAfterId ? "Saved" : "None" },
  ] as NotificationTaskStat[];
}

async function buildNotificationsPayload(): Promise<NotificationsPayload> {
  await dbConnect();

  const [
    activeUploadJob,
    latestCompletedJob,
    allLiveProductsCount,
    liveWantToBuyProductsCount,
  ] = await Promise.all([
    getLatestActiveProductDetailsJob(),
    getLatestCompletedProductDetailsJob(),
    Product.countDocuments({ deletedAt: null }),
    Product.countDocuments({ deletedAt: null, availability: "want_to_buy" }),
  ]);

  const latestState = getPostUploadSyncState(latestCompletedJob);
  const latestSkuList = extractSkuListFromJob(latestCompletedJob);
  const latestCategory = getJobCategory(latestCompletedJob);
  const hardcopyRelevant = isSolvedAssignmentsCategory(latestCategory);

  const availabilityState = getSyncTaskState(latestState, "availability");
  const comboState = getSyncTaskState(latestState, "combo");
  const hardcopyState = getSyncTaskState(latestState, "hardcopy");
  const fullSyncState = getSyncTaskState(latestState, "fullSync");
  const availabilityRuleAllState = getSyncTaskState(latestState, "availabilityRuleAll");
  const availabilityRuleWantToBuyState = getSyncTaskState(
    latestState,
    "availabilityRuleWantToBuy"
  );

  const availabilityStatus = computeTaskStatus({
    explicitState: availabilityState,
    latestCompletedJob,
    activeUploadJob,
    relevant: Boolean(latestCompletedJob),
  });

  const comboStatus = computeTaskStatus({
    explicitState: comboState,
    latestCompletedJob,
    activeUploadJob,
    relevant: Boolean(latestCompletedJob),
  });

  const hardcopyStatus = computeTaskStatus({
    explicitState: hardcopyState,
    latestCompletedJob,
    activeUploadJob,
    relevant: Boolean(latestCompletedJob) && hardcopyRelevant,
  });

  const availabilityRuleAllStatus = computeStandaloneTaskStatus({
    explicitState: availabilityRuleAllState,
    activeUploadJob,
  });

  const availabilityRuleWantToBuyStatus = computeStandaloneTaskStatus({
    explicitState: availabilityRuleWantToBuyState,
    activeUploadJob,
  });

  const anyPendingCore =
    availabilityStatus === "pending" ||
    comboStatus === "pending" ||
    hardcopyStatus === "pending" ||
    availabilityStatus === "needs_attention" ||
    comboStatus === "needs_attention" ||
    hardcopyStatus === "needs_attention" ||
    availabilityStatus === "running" ||
    comboStatus === "running" ||
    hardcopyStatus === "running";

  let fullSyncStatus = computeTaskStatus({
    explicitState: fullSyncState,
    latestCompletedJob,
    activeUploadJob,
    relevant: Boolean(latestCompletedJob),
  });

  if (fullSyncStatus !== "running" && fullSyncStatus !== "needs_attention") {
    fullSyncStatus = activeUploadJob
      ? "disabled"
      : anyPendingCore
      ? "pending"
      : latestCompletedJob
      ? "completed"
      : "idle";
  }

  const reminderStatus: TaskStatus = activeUploadJob
    ? "running"
    : anyPendingCore
    ? "pending"
    : latestCompletedJob
    ? "completed"
    : "idle";

  const sections: NotificationSection[] = [
    {
      key: "post-upload-syncs",
      title: "Post Upload Syncs",
      description:
        "Ye compulsory sync tasks product upload ke baad chal sakti hain. Inhe future me fully automatic ya hybrid background mode par shift kiya ja sakta hai.",
      tone: "amber",
      tasks: [
        {
          key: "availability-sync",
          title: "Availability Sync",
          description:
            "Solved PDF aur official paper flags ke basis par latest uploaded products ki final availability refresh karo.",
          sectionKey: "post-upload-syncs",
          status: availabilityStatus,
          pendingCount:
            availabilityStatus === "pending" || availabilityStatus === "running"
              ? Math.max(
                  0,
                  latestSkuList.length - safeNum(availabilityState?.stats?.processed, 0)
                )
              : 0,
          autoMode: availabilityState.desiredMode || "hybrid",
          lastRunAt: availabilityState.lastCompletedAt || null,
          nextSuggestedAt:
            availabilityStatus === "pending" ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Current upload job abhi chal rahi hai. Upload complete hone ke baad ye sync run karna best rahega."
            : "Ye task latest completed bulk upload ke SKUs par targeted sync karti hai.",
          hint:
            safeStr(availabilityState.lastMessage) ||
            "Badi upload ke case me ye task progress ke saath run hogi.",
          stats: buildAvailabilityStats({
            latestCompletedJob,
            latestSkuList,
            taskState: availabilityState,
          }),
          actions: [
            { key: "run", label: "Run Now", intent: "primary" },
            { key: "schedule", label: "Mark for Auto" },
          ],
        },
        {
          key: "combo-sync",
          title: "Combo Sync",
          description:
            "Generated combo data ko latest uploaded products ke context me refresh karo.",
          sectionKey: "post-upload-syncs",
          status: comboStatus,
          pendingCount:
            comboStatus === "pending" || comboStatus === "running" ? 1 : 0,
          autoMode: comboState.desiredMode || "hybrid",
          lastRunAt: comboState.lastCompletedAt || null,
          nextSuggestedAt:
            comboStatus === "pending" ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Current upload running hai. Upload complete hone ke baad combo sync better rahegi."
            : "Combo sync ko product creation flow se alag rakhna upload speed ke liye better hai.",
          hint:
            safeStr(comboState.lastMessage) ||
            "Ye task phase-wise progress ke saath generated combo logic refresh karegi.",
          stats: buildComboStats(comboState),
          actions: [
            { key: "run", label: "Run Now", intent: "primary" },
            { key: "schedule", label: "Mark for Auto" },
          ],
        },
        {
          key: "hardcopy-sync",
          title: "Hardcopy Sync",
          description:
            "Solved Assignments ke basis par auto-generated handwritten hardcopy products create/update karo.",
          sectionKey: "post-upload-syncs",
          status: hardcopyStatus,
          pendingCount:
            (hardcopyStatus === "pending" || hardcopyStatus === "running") &&
            hardcopyRelevant
              ? Math.max(
                  1,
                  safeNum(hardcopyState?.stats?.totalEligibleSources, 0) -
                    safeNum(hardcopyState?.stats?.processed, 0)
                )
              : 0,
          autoMode: hardcopyState.desiredMode || "hybrid",
          lastRunAt: hardcopyState.lastCompletedAt || null,
          nextSuggestedAt:
            hardcopyStatus === "pending" ? new Date().toISOString() : null,
          note: hardcopyRelevant
            ? activeUploadJob
              ? "Current upload running hai. Hardcopy sync upload complete hone ke baad best rahegi."
              : "Hardcopy auto-generation strong feature hai, isliye isko alag run karna safe hai."
            : "Latest completed upload Solved Assignments category ki nahi hai, isliye hardcopy sync abhi applicable nahi hai.",
          hint:
            safeStr(hardcopyState.lastMessage) ||
            "Large hardcopy sync batches me progress ke saath chal sakti hai.",
          stats: buildHardcopyStats(hardcopyState),
          actions: [
            { key: "run", label: "Run Now", intent: "primary" },
            { key: "schedule", label: "Mark for Auto" },
          ],
        },
        {
          key: "run-all-post-syncs",
          title: "Run All Post Syncs",
          description:
            "Availability, Combo aur Hardcopy sync ko sequentially trigger karo.",
          sectionKey: "post-upload-syncs",
          status: fullSyncStatus,
          pendingCount: anyPendingCore ? 1 : 0,
          autoMode: fullSyncState.desiredMode || "manual",
          lastRunAt: fullSyncState.lastCompletedAt || null,
          nextSuggestedAt: anyPendingCore ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Bulk upload complete hone ke baad Run Full Sync use karna better hai."
            : "Emergency recovery ya post-upload completion ke liye ye quick action useful hai.",
          hint:
            safeStr(fullSyncState.lastMessage) ||
            "Run Full Sync ab child tasks ko real sequential progress ke saath execute karegi.",
          stats: buildFullSyncStats({
            latestCategory,
            hardcopyRelevant,
            taskState: fullSyncState,
          }),
          actions: [{ key: "run", label: "Run Full Sync", intent: "primary" }],
        },
      ],
    },
    {
      key: "availability-rule-repair",
      title: "Availability Rule Repair",
      description:
        'Rule: only details = "Want to Buy", details + official paper = "On Demand", details + solved PDF = "Available". Ye section purane stale products ko force-sync karke exact rule ke hisab se repair karega.',
      tone: "violet",
      tasks: [
        {
          key: "availability-rule-sync-all-products",
          title: "Availability Rule Sync (All Products)",
          description:
            "Pure live product catalog par availability rule dobara run karo. Isse stale statuses recalculate ho jayenge.",
          sectionKey: "availability-rule-repair",
          status: availabilityRuleAllStatus,
          pendingCount:
            availabilityRuleAllStatus === "running" || availabilityRuleAllStatus === "pending"
              ? Math.max(
                  0,
                  Math.max(
                    safeNum(availabilityRuleAllState?.stats?.totalSourceProducts, 0),
                    safeNum(allLiveProductsCount, 0)
                  ) - safeNum(availabilityRuleAllState?.stats?.processed, 0)
                )
              : Math.max(0, safeNum(allLiveProductsCount, 0)),
          autoMode: "manual",
          lastRunAt: availabilityRuleAllState.lastCompletedAt || null,
          nextSuggestedAt:
            availabilityRuleAllStatus === "pending" ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Current bulk upload running hai. Better hai ye repair sync upload complete hone ke baad chalai jaye."
            : "Ye option tab use karo jab large stale mismatch ho aur poore catalog ko re-check karna ho.",
          hint:
            safeStr(availabilityRuleAllState.lastMessage) ||
            "Manual repair sync. Safe to rerun.",
          stats: buildAvailabilityRuleStats({
            taskState: availabilityRuleAllState,
            totalFallback: safeNum(allLiveProductsCount, 0),
            scopeLabel: "All live products",
          }),
          actions: [{ key: "run", label: "Run All Products Sync", intent: "primary" }],
        },
        {
          key: "availability-rule-sync-want-to-buy-only",
          title: "Availability Rule Sync (Only Want to Buy Products)",
          description:
            'Sirf current "Want to Buy" products ko re-check karo. Aapke current PYQ mismatch fix karne ke liye ye fastest repair option hai.',
          sectionKey: "availability-rule-repair",
          status: availabilityRuleWantToBuyStatus,
          pendingCount:
            availabilityRuleWantToBuyStatus === "running" ||
            availabilityRuleWantToBuyStatus === "pending"
              ? Math.max(
                  0,
                  Math.max(
                    safeNum(
                      availabilityRuleWantToBuyState?.stats?.totalSourceProducts,
                      0
                    ),
                    safeNum(liveWantToBuyProductsCount, 0)
                  ) - safeNum(availabilityRuleWantToBuyState?.stats?.processed, 0)
                )
              : Math.max(0, safeNum(liveWantToBuyProductsCount, 0)),
          autoMode: "manual",
          lastRunAt: availabilityRuleWantToBuyState.lastCompletedAt || null,
          nextSuggestedAt:
            availabilityRuleWantToBuyStatus === "pending"
              ? new Date().toISOString()
              : null,
          note: activeUploadJob
            ? "Current bulk upload running hai. Better hai ye repair sync upload complete hone ke baad chalai jaye."
            : "Aapke current stale Want to Buy products ko quickly On Demand/Available me repair karne ke liye best option.",
          hint:
            safeStr(availabilityRuleWantToBuyState.lastMessage) ||
            "Manual repair sync. Safe to rerun.",
          stats: buildAvailabilityRuleStats({
            taskState: availabilityRuleWantToBuyState,
            totalFallback: safeNum(liveWantToBuyProductsCount, 0),
            scopeLabel: 'Only current "Want to Buy" products',
          }),
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
        "Future me yahin par aur admin notifications, migration tasks, repair jobs, audit alerts aur reminders add kiye ja sakte hain.",
      tone: "blue",
      tasks: [
        {
          key: "bulk-upload-reminder",
          title: "Post Upload Reminder",
          description:
            "Jab new products upload ho jayein, to sync page check karne aur required tasks chalane ka reminder yahin dikhega.",
          sectionKey: "system-notices",
          status: reminderStatus,
          pendingCount: anyPendingCore ? 1 : 0,
          autoMode: "manual",
          lastRunAt: latestCompletedJob ? getJobCompletionTimestamp(latestCompletedJob) : null,
          nextSuggestedAt: anyPendingCore ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Upload currently running."
            : anyPendingCore
            ? "Latest upload ke baad ek ya zyada sync tasks pending hain."
            : "No post-upload sync reminder pending right now.",
          hint: "Yahin par future admin reminders bhi show kiye ja sakte hain.",
          stats: [
            { label: "Active Upload", value: activeUploadJob ? "Yes" : "No" },
            { label: "Pending Core Tasks", value: anyPendingCore ? "Yes" : "No" },
          ],
          actions: [{ key: "refresh", label: "Refresh Status" }],
        },
      ],
    },
  ];

  const tasks = sections.flatMap((section) => section.tasks || []);
  const runningTasks = tasks.filter((x) => x.status === "running").length;

  return {
    ok: true,
    source: "live",
    autoRefreshSeconds:
      runningTasks > 0 ? FAST_AUTO_REFRESH_SECONDS : NORMAL_AUTO_REFRESH_SECONDS,
    sections,
    recentEvents: buildRecentEventsFromJob({
      latestCompletedJob,
      activeUploadJob,
    }),
    summary: {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((x) => x.status === "pending").length,
      runningTasks,
      needsAttentionTasks: tasks.filter((x) => x.status === "needs_attention").length,
    },
  };
}

async function markTaskRunning(
  taskKey: SyncTaskKey,
  actor: string,
  args?: {
    lastMessage?: string;
    statsPatch?: Record<string, any>;
    extraPatch?: Record<string, any>;
    eventTitle?: string;
    eventMessage?: string;
  }
) {
  await mutateLatestCompletedJobPostSync((_job, state) => {
    const prev = getSyncTaskState(state, taskKey);
    const prevStats = getTaskStatsObject(prev);

    state[taskKey] = {
      ...prev,
      status: "running",
      requestedAt: new Date().toISOString(),
      requestedBy: actor,
      lastStartedAt: new Date().toISOString(),
      lastMessage:
        safeStr(args?.lastMessage) ||
        `${safeStr(taskKey)} sync started by ${actor}.`,
      stats: {
        ...prevStats,
        ...(args?.statsPatch || {}),
      },
      ...(args?.extraPatch || {}),
    };

    pushRecentEvent(
      state,
      createEvent(
        "info",
        safeStr(args?.eventTitle || `${safeStr(taskKey)} started`),
        safeStr(args?.eventMessage || `${safeStr(taskKey)} sync started by ${actor}.`)
      )
    );
  });
}

async function markTaskScheduled(
  taskKey: SyncTaskKey,
  actor: string,
  label: string
) {
  await mutateLatestCompletedJobPostSync((_job, state) => {
    const prev = getSyncTaskState(state, taskKey);
    state[taskKey] = {
      ...prev,
      desiredMode: "auto",
      requestedAt: new Date().toISOString(),
      requestedBy: actor,
      lastMessage: `${label} marked for future auto mode by ${actor}.`,
    };
    pushRecentEvent(
      state,
      createEvent(
        "info",
        `${label} marked for auto`,
        `${label} ko future auto mode ke liye mark kiya gaya.`
      )
    );
  });
}

async function patchRunningTaskProgress(args: {
  taskKey: SyncTaskKey;
  actor: string;
  message?: string;
  statsPatch?: Record<string, any>;
  extraPatch?: Record<string, any>;
}) {
  await mutateLatestCompletedJobPostSync((_job, state) => {
    const prev = getSyncTaskState(state, args.taskKey);
    const prevStats = getTaskStatsObject(prev);

    state[args.taskKey] = {
      ...prev,
      status: "running",
      requestedBy: args.actor,
      lastStartedAt: prev.lastStartedAt || new Date().toISOString(),
      lastMessage: safeStr(args.message || prev.lastMessage || ""),
      stats: {
        ...prevStats,
        ...(args.statsPatch || {}),
      },
      ...(args.extraPatch || {}),
    };
  });
}

async function markTaskResult(args: {
  taskKey: SyncTaskKey;
  status: TaskStatus;
  actor: string;
  message: string;
  stats?: Record<string, any>;
  extraPatch?: Record<string, any>;
  eventLevel?: RecentEventLevel;
  eventTitle?: string;
}) {
  await mutateLatestCompletedJobPostSync((_job, state) => {
    const prev = getSyncTaskState(state, args.taskKey);
    const prevStats = getTaskStatsObject(prev);

    state[args.taskKey] = {
      ...prev,
      status: args.status,
      requestedBy: args.actor,
      lastCompletedAt:
        args.status === "running" ? prev.lastCompletedAt || null : new Date().toISOString(),
      lastMessage: args.message,
      stats: {
        ...prevStats,
        ...(args.stats || {}),
      },
      ...(args.extraPatch || {}),
    };

    pushRecentEvent(
      state,
      createEvent(
        args.eventLevel || (args.status === "completed" ? "success" : "warning"),
        args.eventTitle || `${safeStr(args.taskKey)} updated`,
        args.message
      )
    );
  });
}

async function runAvailabilitySync(
  actor: string,
  options: RunBudgetOptions = {}
) {
  const latestJob = await getLatestCompletedProductDetailsJob();
  if (!latestJob) {
    throw new Error("No completed bulk product details job found.");
  }

  const activeJob = await getLatestActiveProductDetailsJob();
  if (activeJob) {
    throw new Error("Current bulk upload abhi chal rahi hai. Availability sync baad me run karo.");
  }

  const allSkus = extractSkuListFromJob(latestJob);
  if (!allSkus.length) {
    throw new Error("Latest completed job me valid SKU rows nahi mili.");
  }

  const state = getPostUploadSyncState(latestJob);
  const taskState = getSyncTaskState(state, "availability");
  const latestJobCompletedAt = getJobCompletionTimestamp(latestJob);

  const startedAtMs = safeNum(options.startedAtMs, Date.now());
  const timeBudgetMs = getRunBudgetMs(options);
  const runUntilComplete = options.runUntilComplete === true;

  let cursor = 0;
  if (
    safeStr(taskState.sourceJobCompletedAt) === latestJobCompletedAt &&
    safeNum(taskState.nextCursor, 0) > 0
  ) {
    cursor = Math.max(0, safeNum(taskState.nextCursor, 0));
  }

  const total = allSkus.length;

  await markTaskRunning("availability", actor, {
    lastMessage: `Availability sync started. ${cursor}/${total} SKUs already covered.`,
    statsPatch: {
      totalSourceSkus: total,
      processed: cursor,
      synced: safeNum(taskState?.stats?.synced, 0),
      failed: safeNum(taskState?.stats?.failed, 0),
      batchSize: AVAILABILITY_BATCH_SIZE,
      progressPercent: computePercent(cursor, total),
    },
    extraPatch: {
      sourceJobCompletedAt: latestJobCompletedAt,
    },
    eventTitle: "Availability sync started",
    eventMessage: `Availability sync started by ${actor}.`,
  });

  let processed = cursor;
  let synced = safeNum(taskState?.stats?.synced, 0);
  let failed = safeNum(taskState?.stats?.failed, 0);

  while (processed < total) {
    if (!hasTimeBudgetRemaining(startedAtMs, timeBudgetMs)) {
      break;
    }

    const batch = allSkus.slice(processed, processed + AVAILABILITY_BATCH_SIZE);
    if (!batch.length) break;

    for (let i = 0; i < batch.length; i += 1) {
      if (!hasTimeBudgetRemaining(startedAtMs, timeBudgetMs)) {
        break;
      }

      const sku = batch[i];

      try {
        const one = await syncProductAvailabilityBySku(sku);
        if (one?.ok) synced += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }

      processed += 1;

      const shouldPersist =
        processed === total ||
        i === batch.length - 1 ||
        processed % PROGRESS_SAVE_EVERY === 0;

      if (shouldPersist) {
        await patchRunningTaskProgress({
          taskKey: "availability",
          actor,
          message: `Availability sync running. ${processed}/${total} SKUs covered.`,
          statsPatch: {
            totalSourceSkus: total,
            processed,
            synced,
            failed,
            batchSize: AVAILABILITY_BATCH_SIZE,
            progressPercent: computePercent(processed, total),
          },
          extraPatch: {
            nextCursor: processed < total ? processed : 0,
            sourceJobCompletedAt: latestJobCompletedAt,
          },
        });
      }
    }

    if (!runUntilComplete) {
      break;
    }
  }

  const hasMore = processed < total;
  const message = hasMore
    ? `Availability sync paused after ${processed}/${total} SKUs. Next run se resume hogi.`
    : `Availability sync complete. ${total} SKUs covered.`;

  await markTaskResult({
    taskKey: "availability",
    status: hasMore ? "pending" : "completed",
    actor,
    message,
    stats: {
      totalSourceSkus: total,
      processed,
      synced,
      failed,
      batchSize: AVAILABILITY_BATCH_SIZE,
      progressPercent: computePercent(processed, total),
    },
    extraPatch: {
      nextCursor: hasMore ? processed : 0,
      sourceJobCompletedAt: latestJobCompletedAt,
    },
    eventTitle: hasMore
      ? "Availability sync paused"
      : "Availability sync completed",
    eventLevel: hasMore ? "warning" : "success",
  });

  return {
    ok: true,
    hasMore,
    result: {
      total,
      processed,
      synced,
      failed,
    },
    message,
  };
}

async function runComboSync(actor: string, options: RunBudgetOptions = {}) {
  const latestJob = await getLatestCompletedProductDetailsJob();
  if (!latestJob) {
    throw new Error("No completed bulk product details job found.");
  }

  const activeJob = await getLatestActiveProductDetailsJob();
  if (activeJob) {
    throw new Error("Current bulk upload abhi chal rahi hai. Combo sync baad me run karo.");
  }

  const startedAtMs = safeNum(options.startedAtMs, Date.now());
  const timeBudgetMs = getRunBudgetMs(options);
  const runUntilComplete = options.runUntilComplete === true;

  const phases: Array<{
    key: string;
    label: string;
    fn: () => Promise<any>;
  }> = [
    {
      key: "pyq",
      label: "PYQ combo refresh",
      fn: () => syncAllGeneratedCombos({ includePyq: true, includeGeneric: false }),
    },
    ...GENERIC_COMBO_CATEGORY_SLUGS.map((categorySlug) => ({
      key: `generic:${categorySlug}`,
      label: `Generic combo refresh (${categorySlug})`,
      fn: () =>
        syncAllGeneratedCombos({
          includePyq: false,
          includeGeneric: true,
          genericCategorySlugs: [categorySlug],
        }),
    })),
  ];

  await markTaskRunning("combo", actor, {
    lastMessage: `Combo sync started. 0/${phases.length} phases complete.`,
    statsPatch: {
      totalPhases: phases.length,
      processedPhases: 0,
      resultBuckets: 0,
      includePyq: true,
      includeGeneric: true,
      currentPhaseLabel: phases[0]?.label || "—",
      progressPercent: 0,
    },
    eventTitle: "Combo sync started",
    eventMessage: `Combo sync started by ${actor}.`,
  });

  let processedPhases = 0;
  let resultBuckets = 0;
  let currentPhaseLabel = phases[0]?.label || "—";

  for (let i = 0; i < phases.length; i += 1) {
    if (!hasTimeBudgetRemaining(startedAtMs, timeBudgetMs)) {
      break;
    }

    const phase = phases[i];
    currentPhaseLabel = phase.label;

    await patchRunningTaskProgress({
      taskKey: "combo",
      actor,
      message: `${phase.label} running.`,
      statsPatch: {
        totalPhases: phases.length,
        processedPhases,
        resultBuckets,
        includePyq: true,
        includeGeneric: true,
        currentPhaseLabel,
        progressPercent: computePercent(processedPhases, phases.length),
      },
    });

    const result = await phase.fn();
    const buckets = Array.isArray(result?.results) ? result.results.length : 0;

    processedPhases += 1;
    resultBuckets += buckets;

    await patchRunningTaskProgress({
      taskKey: "combo",
      actor,
      message: `${phase.label} completed. ${processedPhases}/${phases.length} phases done.`,
      statsPatch: {
        totalPhases: phases.length,
        processedPhases,
        resultBuckets,
        includePyq: true,
        includeGeneric: true,
        currentPhaseLabel,
        progressPercent: computePercent(processedPhases, phases.length),
      },
    });

    if (!runUntilComplete) {
      break;
    }
  }

  const hasMore = processedPhases < phases.length;
  const message = hasMore
    ? `Combo sync paused after ${processedPhases}/${phases.length} phases. Next run se restart safe hai.`
    : `Combo sync complete. ${resultBuckets} result bucket(s) returned.`;

  await markTaskResult({
    taskKey: "combo",
    status: hasMore ? "pending" : "completed",
    actor,
    message,
    stats: {
      totalPhases: phases.length,
      processedPhases,
      resultBuckets,
      includePyq: true,
      includeGeneric: true,
      currentPhaseLabel,
      progressPercent: computePercent(processedPhases, phases.length),
    },
    eventTitle: hasMore ? "Combo sync paused" : "Combo sync completed",
    eventLevel: hasMore ? "warning" : "success",
  });

  return {
    ok: true,
    hasMore,
    result: {
      totalPhases: phases.length,
      processedPhases,
      resultBuckets,
    },
    message,
  };
}

async function runHardcopySync(
  actor: string,
  options: RunBudgetOptions = {}
) {
  const latestJob = await getLatestCompletedProductDetailsJob();
  if (!latestJob) {
    throw new Error("No completed bulk product details job found.");
  }

  const activeJob = await getLatestActiveProductDetailsJob();
  if (activeJob) {
    throw new Error("Current bulk upload abhi chal rahi hai. Hardcopy sync baad me run karo.");
  }

  const category = getJobCategory(latestJob);
  if (!isSolvedAssignmentsCategory(category)) {
    throw new Error("Latest completed upload Solved Assignments category ki nahi hai.");
  }

  const state = getPostUploadSyncState(latestJob);
  const taskState = getSyncTaskState(state, "hardcopy");

  const startedAtMs = safeNum(options.startedAtMs, Date.now());
  const timeBudgetMs = getRunBudgetMs(options);
  const runUntilComplete = options.runUntilComplete === true;

  let skip = Math.max(0, safeNum(taskState.nextSkip, 0));
  let totalEligibleSources = safeNum(taskState?.stats?.totalEligibleSources, 0);
  let processed = safeNum(taskState?.stats?.processed, 0);
  let created = safeNum(taskState?.stats?.created, 0);
  let updated = safeNum(taskState?.stats?.updated, 0);
  let failed = safeNum(taskState?.stats?.failed, 0);

  await markTaskRunning("hardcopy", actor, {
    lastMessage: "Hardcopy sync started.",
    statsPatch: {
      totalEligibleSources,
      processed,
      created,
      updated,
      failed,
      batchSize: HARDCOPY_BATCH_SIZE,
      progressPercent: computePercent(processed, totalEligibleSources),
    },
    extraPatch: {
      nextSkip: skip,
    },
    eventTitle: "Hardcopy sync started",
    eventMessage: `Hardcopy sync started by ${actor}.`,
  });

  while (hasTimeBudgetRemaining(startedAtMs, timeBudgetMs)) {
    const result = await backfillGeneratedHardcopies({
      dryRun: false,
      limit: HARDCOPY_BATCH_SIZE,
      skip,
    });

    const summary = result?.summary || {};
    const batchProcessed = safeNum(summary?.processed, 0);

    totalEligibleSources = Math.max(
      totalEligibleSources,
      safeNum(summary?.totalEligibleSources, 0)
    );
    processed = Math.max(processed, skip + batchProcessed);
    created += safeNum(summary?.created, 0);
    updated += safeNum(summary?.updated, 0);
    failed += safeNum(summary?.failed, 0);

    const hasMore = Boolean(summary?.hasMore);
    const nextSkip = Math.max(0, safeNum(summary?.nextSkip, skip + batchProcessed));
    skip = nextSkip;

    await patchRunningTaskProgress({
      taskKey: "hardcopy",
      actor,
      message: hasMore
        ? `Hardcopy sync running. ${processed}/${totalEligibleSources || 0} sources covered.`
        : `Hardcopy sync finalizing.`,
      statsPatch: {
        totalEligibleSources,
        processed,
        created,
        updated,
        failed,
        batchSize: HARDCOPY_BATCH_SIZE,
        progressPercent: computePercent(processed, totalEligibleSources),
      },
      extraPatch: {
        nextSkip: hasMore ? nextSkip : 0,
      },
    });

    if (!hasMore || !runUntilComplete) {
      const finalMessage = hasMore
        ? `Hardcopy sync paused after ${processed}/${totalEligibleSources} sources. Next run se resume hogi.`
        : `Hardcopy sync complete for current eligible scope.`;

      await markTaskResult({
        taskKey: "hardcopy",
        status: hasMore ? "pending" : "completed",
        actor,
        message: finalMessage,
        stats: {
          totalEligibleSources,
          processed,
          created,
          updated,
          failed,
          batchSize: HARDCOPY_BATCH_SIZE,
          progressPercent: computePercent(processed, totalEligibleSources),
        },
        extraPatch: {
          nextSkip: hasMore ? nextSkip : 0,
        },
        eventTitle: hasMore
          ? "Hardcopy sync paused"
          : "Hardcopy sync completed",
        eventLevel: hasMore ? "warning" : "success",
      });

      return {
        ok: true,
        hasMore,
        result,
        message: finalMessage,
      };
    }
  }

  const message = `Hardcopy sync paused after ${processed}/${totalEligibleSources} sources due to run budget.`;

  await markTaskResult({
    taskKey: "hardcopy",
    status: "pending",
    actor,
    message,
    stats: {
      totalEligibleSources,
      processed,
      created,
      updated,
      failed,
      batchSize: HARDCOPY_BATCH_SIZE,
      progressPercent: computePercent(processed, totalEligibleSources),
    },
    extraPatch: {
      nextSkip: skip,
    },
    eventTitle: "Hardcopy sync paused",
    eventLevel: "warning",
  });

  return {
    ok: true,
    hasMore: true,
    result: {
      summary: {
        totalEligibleSources,
        processed,
        created,
        updated,
        failed,
        nextSkip: skip,
      },
    },
    message,
  };
}

async function countProductsForAvailabilityScope(scope: AvailabilityRuleScope) {
  await dbConnect();

  const query: any = { deletedAt: null };
  if (scope === "want_to_buy") {
    query.availability = "want_to_buy";
  }

  return Product.countDocuments(query);
}

async function fetchProductsForAvailabilityScope(args: {
  scope: AvailabilityRuleScope;
  afterId?: string;
  limit: number;
}) {
  await dbConnect();

  const query: any = { deletedAt: null };

  if (args.scope === "want_to_buy") {
    query.availability = "want_to_buy";
  }

  const afterId = safeStr(args.afterId);
  if (afterId) {
    query._id = { $gt: afterId };
  }

  const rows: any[] = await Product.find(query)
    .sort({ _id: 1 })
    .limit(Math.max(1, safeNum(args.limit, AVAILABILITY_RULE_BATCH_SIZE)))
    .select("_id sku availability")
    .lean();

  return Array.isArray(rows) ? rows : [];
}

async function hasMoreProductsForAvailabilityScope(args: {
  scope: AvailabilityRuleScope;
  afterId?: string;
}) {
  await dbConnect();

  const query: any = { deletedAt: null };

  if (args.scope === "want_to_buy") {
    query.availability = "want_to_buy";
  }

  const afterId = safeStr(args.afterId);
  if (afterId) {
    query._id = { $gt: afterId };
  }

  const one: any = await Product.findOne(query).select("_id").sort({ _id: 1 }).lean();
  return Boolean(one?._id);
}

function getRuleRepairTaskKey(scope: AvailabilityRuleScope): SyncTaskKey {
  return scope === "all" ? "availabilityRuleAll" : "availabilityRuleWantToBuy";
}

function getRuleRepairScopeLabel(scope: AvailabilityRuleScope) {
  return scope === "all" ? "all live products" : 'current "Want to Buy" products';
}

function shouldResumeRuleRepairTask(taskState: PostSyncTaskState) {
  const status = safeStr(taskState?.status);
  const nextAfterId = safeStr((taskState as any)?.nextAfterId);
  return (status === "pending" || status === "running") && Boolean(nextAfterId);
}

async function runAvailabilityRuleSyncByScope(
  actor: string,
  scope: AvailabilityRuleScope,
  options: RunBudgetOptions = {}
) {
  const activeJob = await getLatestActiveProductDetailsJob();
  if (activeJob) {
    throw new Error(
      "Current bulk upload abhi chal rahi hai. Availability rule repair sync baad me run karo."
    );
  }

  const latestJob = await getLatestCompletedProductDetailsJob();
  const latestState = getPostUploadSyncState(latestJob);
  const taskKey = getRuleRepairTaskKey(scope);
  const taskState = getSyncTaskState(latestState, taskKey);

  const startedAtMs = safeNum(options.startedAtMs, Date.now());
  const timeBudgetMs = getRunBudgetMs(options);
  const runUntilComplete = options.runUntilComplete === true;

  const total = Math.max(0, safeNum(await countProductsForAvailabilityScope(scope), 0));
  const resume = shouldResumeRuleRepairTask(taskState);

  let nextAfterId = resume ? safeStr((taskState as any)?.nextAfterId) : "";
  let processed = resume ? safeNum(taskState?.stats?.processed, 0) : 0;
  let synced = resume ? safeNum(taskState?.stats?.synced, 0) : 0;
  let failed = resume ? safeNum(taskState?.stats?.failed, 0) : 0;
  let availableCount = resume ? safeNum(taskState?.stats?.availableCount, 0) : 0;
  let onDemandCount = resume ? safeNum(taskState?.stats?.onDemandCount, 0) : 0;
  let wantToBuyCount = resume ? safeNum(taskState?.stats?.wantToBuyCount, 0) : 0;

  await markTaskRunning(taskKey, actor, {
    lastMessage: `Availability rule repair started for ${getRuleRepairScopeLabel(
      scope
    )}. ${processed}/${total} processed.`,
    statsPatch: {
      scope,
      totalSourceProducts: total,
      processed,
      synced,
      failed,
      availableCount,
      onDemandCount,
      wantToBuyCount,
      batchSize: AVAILABILITY_RULE_BATCH_SIZE,
      progressPercent: computePercent(processed, total),
    },
    extraPatch: {
      nextAfterId,
    },
    eventTitle:
      scope === "all"
        ? "Availability rule sync started (all products)"
        : "Availability rule sync started (Want to Buy only)",
    eventMessage: `Availability rule repair started by ${actor} for ${getRuleRepairScopeLabel(
      scope
    )}.`,
  });

  if (total <= 0) {
    const message =
      scope === "all"
        ? "No live products found for availability rule sync."
        : 'No current "Want to Buy" products found for repair sync.';

    await markTaskResult({
      taskKey,
      status: "completed",
      actor,
      message,
      stats: {
        scope,
        totalSourceProducts: 0,
        processed: 0,
        synced: 0,
        failed: 0,
        availableCount: 0,
        onDemandCount: 0,
        wantToBuyCount: 0,
        batchSize: AVAILABILITY_RULE_BATCH_SIZE,
        progressPercent: 0,
      },
      extraPatch: {
        nextAfterId: "",
      },
      eventTitle:
        scope === "all"
          ? "Availability rule sync completed"
          : "Want to Buy repair completed",
      eventLevel: "success",
    });

    return {
      ok: true,
      hasMore: false,
      result: {
        total: 0,
        processed: 0,
        synced: 0,
        failed: 0,
        availableCount: 0,
        onDemandCount: 0,
        wantToBuyCount: 0,
      },
      message,
    };
  }

  while (hasTimeBudgetRemaining(startedAtMs, timeBudgetMs)) {
    const batch = await fetchProductsForAvailabilityScope({
      scope,
      afterId: nextAfterId,
      limit: AVAILABILITY_RULE_BATCH_SIZE,
    });

    if (!batch.length) {
      break;
    }

    for (let i = 0; i < batch.length; i += 1) {
      if (!hasTimeBudgetRemaining(startedAtMs, timeBudgetMs)) {
        break;
      }

      const row = batch[i];
      const sku = safeStr(row?.sku);
      const rowId = safeStr(row?._id);

      try {
        const syncResult: any = await syncProductAvailabilityBySku(sku);

        if (syncResult?.ok) {
          synced += 1;
          const afterAvailability = safeStr(
            syncResult?.after?.availability || syncResult?.snapshot?.availability
          );

          if (afterAvailability === "available") availableCount += 1;
          else if (afterAvailability === "on_demand") onDemandCount += 1;
          else wantToBuyCount += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }

      processed += 1;
      nextAfterId = rowId;

      const shouldPersist =
        i === batch.length - 1 ||
        processed % PROGRESS_SAVE_EVERY === 0;

      if (shouldPersist) {
        await patchRunningTaskProgress({
          taskKey,
          actor,
          message: `Availability rule repair running for ${getRuleRepairScopeLabel(
            scope
          )}. ${processed}/${total} processed.`,
          statsPatch: {
            scope,
            totalSourceProducts: total,
            processed,
            synced,
            failed,
            availableCount,
            onDemandCount,
            wantToBuyCount,
            batchSize: AVAILABILITY_RULE_BATCH_SIZE,
            progressPercent: computePercent(processed, total),
          },
          extraPatch: {
            nextAfterId,
          },
        });
      }
    }

    if (!runUntilComplete) {
      break;
    }
  }

  const hasMore = await hasMoreProductsForAvailabilityScope({
    scope,
    afterId: nextAfterId,
  });

  const message = hasMore
    ? `Availability rule repair paused for ${getRuleRepairScopeLabel(
        scope
      )}. ${processed}/${total} processed.`
    : `Availability rule repair completed for ${getRuleRepairScopeLabel(
        scope
      )}. ${processed}/${total} processed.`;

  await markTaskResult({
    taskKey,
    status: hasMore ? "pending" : "completed",
    actor,
    message,
    stats: {
      scope,
      totalSourceProducts: total,
      processed,
      synced,
      failed,
      availableCount,
      onDemandCount,
      wantToBuyCount,
      batchSize: AVAILABILITY_RULE_BATCH_SIZE,
      progressPercent: computePercent(processed, total),
    },
    extraPatch: {
      nextAfterId: hasMore ? nextAfterId : "",
    },
    eventTitle: hasMore
      ? scope === "all"
        ? "Availability rule sync paused"
        : "Want to Buy repair paused"
      : scope === "all"
      ? "Availability rule sync completed"
      : "Want to Buy repair completed",
    eventLevel: hasMore ? "warning" : "success",
  });

  return {
    ok: true,
    hasMore,
    result: {
      total,
      processed,
      synced,
      failed,
      availableCount,
      onDemandCount,
      wantToBuyCount,
    },
    message,
  };
}

async function runFullSync(actor: string) {
  const latestJob = await getLatestCompletedProductDetailsJob();
  if (!latestJob) {
    throw new Error("No completed bulk product details job found.");
  }

  const activeJob = await getLatestActiveProductDetailsJob();
  if (activeJob) {
    throw new Error("Current bulk upload abhi chal rahi hai. Full sync baad me run karo.");
  }

  const category = getJobCategory(latestJob);
  const hardcopyRelevant = isSolvedAssignmentsCategory(category);
  const totalPhases = hardcopyRelevant ? 3 : 2;
  const startedAtMs = Date.now();
  const timeBudgetMs = DEFAULT_RUN_TIME_BUDGET_MS;

  await markTaskRunning("fullSync", actor, {
    lastMessage: "Full sync started.",
    statsPatch: {
      totalPhases,
      processedPhases: 0,
      currentPhaseLabel: "Availability Sync",
      hasMoreWork: false,
      progressPercent: 0,
    },
    eventTitle: "Full sync started",
    eventMessage: `Full sync started by ${actor}.`,
  });

  let processedPhases = 0;
  let hasMoreWork = false;

  const availability = await runAvailabilitySync(actor, {
    startedAtMs,
    timeBudgetMs,
    runUntilComplete: true,
  });
  processedPhases += 1;
  hasMoreWork = hasMoreWork || Boolean(availability?.hasMore);

  await patchRunningTaskProgress({
    taskKey: "fullSync",
    actor,
    message: "Availability phase completed.",
    statsPatch: {
      totalPhases,
      processedPhases,
      currentPhaseLabel: "Combo Sync",
      hasMoreWork,
      progressPercent: computePercent(processedPhases, totalPhases),
    },
  });

  const combo = await runComboSync(actor, {
    startedAtMs,
    timeBudgetMs,
    runUntilComplete: true,
  });
  processedPhases += 1;
  hasMoreWork = hasMoreWork || Boolean(combo?.hasMore);

  if (hardcopyRelevant) {
    await patchRunningTaskProgress({
      taskKey: "fullSync",
      actor,
      message: "Combo phase completed.",
      statsPatch: {
        totalPhases,
        processedPhases,
        currentPhaseLabel: "Hardcopy Sync",
        hasMoreWork,
        progressPercent: computePercent(processedPhases, totalPhases),
      },
    });

    const hardcopy = await runHardcopySync(actor, {
      startedAtMs,
      timeBudgetMs,
      runUntilComplete: true,
    });
    processedPhases += 1;
    hasMoreWork = hasMoreWork || Boolean(hardcopy?.hasMore);

    const message = hasMoreWork
      ? `Full sync partially completed. Availability: ${safeStr(
          availability?.message
        )} Combo: ${safeStr(combo?.message)} Hardcopy: ${safeStr(
          hardcopy?.message
        )}`
      : `Full sync completed. Availability: ${safeStr(
          availability?.message
        )} Combo: ${safeStr(combo?.message)} Hardcopy: ${safeStr(
          hardcopy?.message
        )}`;

    await markTaskResult({
      taskKey: "fullSync",
      status: hasMoreWork ? "pending" : "completed",
      actor,
      message,
      stats: {
        totalPhases,
        processedPhases,
        currentPhaseLabel: "Done",
        hasMoreWork,
        progressPercent: computePercent(processedPhases, totalPhases),
      },
      eventTitle: hasMoreWork ? "Full sync paused" : "Full sync completed",
      eventLevel: hasMoreWork ? "warning" : "success",
    });

    return {
      ok: true,
      hasMore: hasMoreWork,
      message,
      availability,
      combo,
      hardcopy,
    };
  }

  await markTaskResult({
    taskKey: "hardcopy",
    status: "disabled",
    actor,
    message: "Latest completed upload hardcopy-relevant category ki nahi hai.",
    stats: {
      totalEligibleSources: 0,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      progressPercent: 0,
    },
    eventTitle: "Hardcopy sync skipped",
    eventLevel: "info",
  });

  processedPhases += 1;

  const message = hasMoreWork
    ? `Full sync partially completed. Availability: ${safeStr(
        availability?.message
      )} Combo: ${safeStr(combo?.message)} Hardcopy skipped.`
    : `Full sync completed. Availability: ${safeStr(
        availability?.message
      )} Combo: ${safeStr(combo?.message)} Hardcopy skipped.`;

  await markTaskResult({
    taskKey: "fullSync",
    status: hasMoreWork ? "pending" : "completed",
    actor,
    message,
    stats: {
      totalPhases,
      processedPhases,
      currentPhaseLabel: "Done",
      hasMoreWork,
      progressPercent: computePercent(processedPhases, totalPhases),
    },
    eventTitle: hasMoreWork ? "Full sync paused" : "Full sync completed",
    eventLevel: hasMoreWork ? "warning" : "success",
  });

  return {
    ok: true,
    hasMore: hasMoreWork,
    message,
    availability,
    combo,
    hardcopy: {
      ok: true,
      skipped: true,
      message: "Hardcopy sync not relevant for latest category.",
    },
  };
}

function isAutoRunnableStatus(status: TaskStatus) {
  return status === "pending" || status === "needs_attention";
}

function isAutoRunnableMode(mode?: AutoMode, fallback: AutoMode = "hybrid") {
  const resolved = mode || fallback;
  return resolved === "auto" || resolved === "hybrid";
}

async function pickNextAutoRunnableTask(): Promise<{
  taskKey: PublicTaskKey | "";
  reason: string;
}> {
  const [activeUploadJob, latestCompletedJob] = await Promise.all([
    getLatestActiveProductDetailsJob(),
    getLatestCompletedProductDetailsJob(),
  ]);

  if (activeUploadJob) {
    return {
      taskKey: "",
      reason: "Bulk upload currently running. Auto sync deferred.",
    };
  }

  if (!latestCompletedJob) {
    return {
      taskKey: "",
      reason: "No completed bulk upload found for auto sync.",
    };
  }

  const latestState = getPostUploadSyncState(latestCompletedJob);
  const latestCategory = getJobCategory(latestCompletedJob);
  const hardcopyRelevant = isSolvedAssignmentsCategory(latestCategory);

  const availabilityState = getSyncTaskState(latestState, "availability");
  const comboState = getSyncTaskState(latestState, "combo");
  const hardcopyState = getSyncTaskState(latestState, "hardcopy");
  const fullSyncState = getSyncTaskState(latestState, "fullSync");

  const availabilityStatus = computeTaskStatus({
    explicitState: availabilityState,
    latestCompletedJob,
    activeUploadJob: null,
    relevant: true,
  });

  const comboStatus = computeTaskStatus({
    explicitState: comboState,
    latestCompletedJob,
    activeUploadJob: null,
    relevant: true,
  });

  const hardcopyStatus = computeTaskStatus({
    explicitState: hardcopyState,
    latestCompletedJob,
    activeUploadJob: null,
    relevant: hardcopyRelevant,
  });

  const fullSyncStatus = computeTaskStatus({
    explicitState: fullSyncState,
    latestCompletedJob,
    activeUploadJob: null,
    relevant: true,
  });

  if (
    isAutoRunnableMode(availabilityState.desiredMode, "hybrid") &&
    isAutoRunnableStatus(availabilityStatus)
  ) {
    return {
      taskKey: "availability-sync",
      reason: "Availability auto sync selected.",
    };
  }

  if (
    isAutoRunnableMode(comboState.desiredMode, "hybrid") &&
    isAutoRunnableStatus(comboStatus)
  ) {
    return {
      taskKey: "combo-sync",
      reason: "Combo auto sync selected.",
    };
  }

  if (
    hardcopyRelevant &&
    isAutoRunnableMode(hardcopyState.desiredMode, "hybrid") &&
    isAutoRunnableStatus(hardcopyStatus)
  ) {
    return {
      taskKey: "hardcopy-sync",
      reason: "Hardcopy auto sync selected.",
    };
  }

  if (
    isAutoRunnableMode(fullSyncState.desiredMode, "manual") &&
    isAutoRunnableStatus(fullSyncStatus)
  ) {
    return {
      taskKey: "run-all-post-syncs",
      reason: "Full auto sync selected.",
    };
  }

  return {
    taskKey: "",
    reason: "No eligible auto-run task found.",
  };
}

export async function GET(req: NextRequest) {
  const access = await assertNotificationsAccess(req);
  if (!access.ok) return access.res;

  try {
    const payload = await buildNotificationsPayload();
    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to load notifications"),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = await assertNotificationsAccess(req);
  if (!access.ok) return access.res;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const taskKey = safeStr(body?.taskKey) as PublicTaskKey;
  const actionKey = safeStr(body?.actionKey).toLowerCase();
  const actor = access.actor;
  const isCron = access.mode === "cron";

  if (!taskKey || !actionKey) {
    return NextResponse.json(
      { ok: false, error: "taskKey and actionKey required" },
      { status: 400 }
    );
  }

  if (isCron && !(taskKey === "auto-run" && actionKey === "run")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Cron access only supports auto-run action.",
      },
      { status: 403 }
    );
  }

  let selectedTaskKeyForError: PublicTaskKey = taskKey;

  try {
    if (actionKey === "refresh") {
      const payload = await buildNotificationsPayload();
      return NextResponse.json(
        {
          ok: true,
          message: "Notifications refreshed.",
          sections: payload.sections,
          recentEvents: payload.recentEvents,
          summary: payload.summary,
        },
        { status: 200 }
      );
    }

    if (actionKey === "schedule") {
      if (taskKey === "availability-sync") {
        await markTaskScheduled("availability", actor, "Availability Sync");
      } else if (taskKey === "combo-sync") {
        await markTaskScheduled("combo", actor, "Combo Sync");
      } else if (taskKey === "hardcopy-sync") {
        await markTaskScheduled("hardcopy", actor, "Hardcopy Sync");
      } else {
        return NextResponse.json(
          { ok: false, error: "Unsupported schedule task" },
          { status: 400 }
        );
      }

      const payload = await buildNotificationsPayload();
      return NextResponse.json(
        {
          ok: true,
          message: "Task marked for future auto mode.",
          sections: payload.sections,
          recentEvents: payload.recentEvents,
          summary: payload.summary,
        },
        { status: 200 }
      );
    }

    if (actionKey !== "run") {
      return NextResponse.json(
        { ok: false, error: "Unsupported action" },
        { status: 400 }
      );
    }

    let effectiveTaskKey: PublicTaskKey = taskKey;
    let runResult: any = null;

    if (taskKey === "auto-run") {
      const next = await pickNextAutoRunnableTask();
      if (!next.taskKey) {
        const payload = await buildNotificationsPayload();
        return NextResponse.json(
          {
            ok: true,
            message: next.reason,
            autoRun: {
              ok: true,
              selectedTask: "",
              reason: next.reason,
            },
            sections: payload.sections,
            recentEvents: payload.recentEvents,
            summary: payload.summary,
          },
          { status: 200 }
        );
      }
      effectiveTaskKey = next.taskKey;
    }

    selectedTaskKeyForError = effectiveTaskKey;

    if (effectiveTaskKey === "availability-sync") {
      runResult = await runAvailabilitySync(actor, {
        runUntilComplete: true,
        timeBudgetMs: DEFAULT_RUN_TIME_BUDGET_MS,
      });
    } else if (effectiveTaskKey === "combo-sync") {
      runResult = await runComboSync(actor, {
        runUntilComplete: true,
        timeBudgetMs: DEFAULT_RUN_TIME_BUDGET_MS,
      });
    } else if (effectiveTaskKey === "hardcopy-sync") {
      runResult = await runHardcopySync(actor, {
        runUntilComplete: true,
        timeBudgetMs: DEFAULT_RUN_TIME_BUDGET_MS,
      });
    } else if (effectiveTaskKey === "run-all-post-syncs") {
      runResult = await runFullSync(actor);
    } else if (effectiveTaskKey === "availability-rule-sync-all-products") {
      runResult = await runAvailabilityRuleSyncByScope(actor, "all", {
        runUntilComplete: true,
        timeBudgetMs: DEFAULT_RUN_TIME_BUDGET_MS,
      });
    } else if (effectiveTaskKey === "availability-rule-sync-want-to-buy-only") {
      runResult = await runAvailabilityRuleSyncByScope(actor, "want_to_buy", {
        runUntilComplete: true,
        timeBudgetMs: DEFAULT_RUN_TIME_BUDGET_MS,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: "Unsupported task" },
        { status: 400 }
      );
    }

    const payload = await buildNotificationsPayload();

    return NextResponse.json(
      {
        ok: true,
        message: safeStr(runResult?.message || "Task executed."),
        runResult,
        autoRun:
          taskKey === "auto-run"
            ? {
                ok: true,
                selectedTask: effectiveTaskKey,
              }
            : null,
        sections: payload.sections,
        recentEvents: payload.recentEvents,
        summary: payload.summary,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const latestJob = await getLatestCompletedProductDetailsJob();

    if (latestJob) {
      const mapKey: SyncTaskKey | "" =
        selectedTaskKeyForError === "availability-sync"
          ? "availability"
          : selectedTaskKeyForError === "combo-sync"
          ? "combo"
          : selectedTaskKeyForError === "hardcopy-sync"
          ? "hardcopy"
          : selectedTaskKeyForError === "run-all-post-syncs"
          ? "fullSync"
          : selectedTaskKeyForError === "availability-rule-sync-all-products"
          ? "availabilityRuleAll"
          : selectedTaskKeyForError === "availability-rule-sync-want-to-buy-only"
          ? "availabilityRuleWantToBuy"
          : "";

      if (mapKey) {
        await markTaskResult({
          taskKey: mapKey,
          status: "needs_attention",
          actor,
          message: safeStr(error?.message || "Task execution failed"),
          stats: {},
          eventTitle: "Task failed",
          eventLevel: "error",
        });
      }

      const payload = await buildNotificationsPayload();
      return NextResponse.json(
        {
          ok: false,
          error: safeStr(error?.message || "Task execution failed"),
          sections: payload.sections,
          recentEvents: payload.recentEvents,
          summary: payload.summary,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Task execution failed"),
      },
      { status: 500 }
    );
  }
}