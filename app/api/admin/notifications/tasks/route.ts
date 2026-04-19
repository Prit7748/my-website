import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import BulkUploadJob from "@/models/BulkUploadJob";
import { getAuthUser, hasPermission } from "@/lib/auth";
import { syncAllGeneratedCombos } from "@/lib/comboAutoSync";
import { backfillGeneratedHardcopies } from "@/lib/hardcopyAutoSync";
import { syncProductAvailabilityForAllBySkuList } from "@/lib/productAvailability";

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
type SyncTaskKey = "availability" | "combo" | "hardcopy" | "fullSync";
type PublicTaskKey =
  | "availability-sync"
  | "combo-sync"
  | "hardcopy-sync"
  | "run-all-post-syncs"
  | "bulk-upload-reminder"
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
  stats?: NotificationTaskStat[];
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
  sourceJobCompletedAt?: string | null;
  stats?: Record<string, any>;
};

type PostUploadSyncState = {
  availability?: PostSyncTaskState;
  combo?: PostSyncTaskState;
  hardcopy?: PostSyncTaskState;
  fullSync?: PostSyncTaskState;
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

const PRODUCT_DETAILS_JOB_TYPE = "product_details";
const AVAILABILITY_BATCH_SIZE = 250;
const HARDCOPY_BATCH_SIZE = 200;
const MAX_RECENT_EVENTS = 20;

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
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

async function buildNotificationsPayload(): Promise<NotificationsPayload> {
  const [activeUploadJob, latestCompletedJob] = await Promise.all([
    getLatestActiveProductDetailsJob(),
    getLatestCompletedProductDetailsJob(),
  ]);

  const latestState = getPostUploadSyncState(latestCompletedJob);
  const latestSkuList = extractSkuListFromJob(latestCompletedJob);
  const latestCategory = getJobCategory(latestCompletedJob);
  const hardcopyRelevant = isSolvedAssignmentsCategory(latestCategory);

  const availabilityState = getSyncTaskState(latestState, "availability");
  const comboState = getSyncTaskState(latestState, "combo");
  const hardcopyState = getSyncTaskState(latestState, "hardcopy");
  const fullSyncState = getSyncTaskState(latestState, "fullSync");

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

  const anyPendingCore =
    availabilityStatus === "pending" ||
    comboStatus === "pending" ||
    hardcopyStatus === "pending" ||
    availabilityStatus === "needs_attention" ||
    comboStatus === "needs_attention" ||
    hardcopyStatus === "needs_attention";

  const fullSyncStatus: TaskStatus = activeUploadJob
    ? "disabled"
    : anyPendingCore
    ? "pending"
    : latestCompletedJob
    ? "completed"
    : "idle";

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
            "Solved PDF aur official paper flags ke basis par uploaded products ki final availability refresh karo.",
          sectionKey: "post-upload-syncs",
          status: availabilityStatus,
          pendingCount:
            availabilityStatus === "pending" ? latestSkuList.length : 0,
          autoMode: availabilityState.desiredMode || "hybrid",
          lastRunAt: availabilityState.lastCompletedAt || null,
          nextSuggestedAt:
            availabilityStatus === "pending" ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Current upload job abhi chal rahi hai. Upload complete hone ke baad ye sync run karna best rahega."
            : "Ye task latest completed bulk upload ke SKUs par targeted sync karti hai.",
          hint:
            safeStr(availabilityState.lastMessage) ||
            "Badi upload ke case me ye task batches me run ho sakti hai.",
          stats: [
            { label: "Latest Upload Rows", value: safeNum(latestCompletedJob?.summary?.totalRows, 0) },
            { label: "Target SKUs", value: latestSkuList.length },
            {
              label: "Next Cursor",
              value: safeNum(availabilityState.nextCursor, 0),
            },
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
            "Generated combo data ko latest uploaded products ke context me refresh karo.",
          sectionKey: "post-upload-syncs",
          status: comboStatus,
          pendingCount: comboStatus === "pending" ? 1 : 0,
          autoMode: comboState.desiredMode || "hybrid",
          lastRunAt: comboState.lastCompletedAt || null,
          nextSuggestedAt:
            comboStatus === "pending" ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Current upload running hai. Upload complete hone ke baad combo sync better rahegi."
            : "Combo sync ko product creation flow se alag rakhna upload speed ke liye better hai.",
          hint:
            safeStr(comboState.lastMessage) ||
            "Ye task generated combo logic ko refresh karegi.",
          stats: [
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
            "Solved Assignments ke basis par auto-generated handwritten hardcopy products create/update karo.",
          sectionKey: "post-upload-syncs",
          status: hardcopyStatus,
          pendingCount:
            hardcopyStatus === "pending" && hardcopyRelevant ? 1 : 0,
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
            "Large hardcopy sync batches me chal sakti hai.",
          stats: [
            { label: "Relevant Category", value: hardcopyRelevant ? "Yes" : "No" },
            {
              label: "Next Skip",
              value: safeNum(hardcopyState.nextSkip, 0),
            },
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
            "Availability, Combo aur Hardcopy sync ko sequentially trigger karo.",
          sectionKey: "post-upload-syncs",
          status: fullSyncStatus,
          pendingCount: anyPendingCore ? 1 : 0,
          autoMode: fullSyncState.desiredMode || "manual",
          lastRunAt: fullSyncState.lastCompletedAt || null,
          nextSuggestedAt:
            anyPendingCore ? new Date().toISOString() : null,
          note: activeUploadJob
            ? "Bulk upload complete hone ke baad Run Full Sync use karna better hai."
            : "Emergency recovery ya post-upload completion ke liye ye quick action useful hai.",
          hint:
            safeStr(fullSyncState.lastMessage) ||
            "Run Full Sync bounded mode me chalegi, taaki request bahut heavy na ho.",
          stats: [
            { label: "Includes", value: hardcopyRelevant ? "3 tasks" : "2 tasks" },
            { label: "Latest Category", value: latestCategory || "—" },
          ],
          actions: [
            { key: "run", label: "Run Full Sync", intent: "primary" },
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

  return {
    ok: true,
    source: "live",
    autoRefreshSeconds: 30,
    sections,
    recentEvents: buildRecentEventsFromJob({
      latestCompletedJob,
      activeUploadJob,
    }),
    summary: {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((x) => x.status === "pending").length,
      runningTasks: tasks.filter((x) => x.status === "running").length,
      needsAttentionTasks: tasks.filter((x) => x.status === "needs_attention").length,
    },
  };
}

async function markTaskRunning(taskKey: SyncTaskKey, actor: string) {
  await mutateLatestCompletedJobPostSync((_job, state) => {
    const prev = getSyncTaskState(state, taskKey);
    state[taskKey] = {
      ...prev,
      status: "running",
      requestedAt: prev.requestedAt || new Date().toISOString(),
      requestedBy: actor,
      lastStartedAt: new Date().toISOString(),
      lastMessage: `${safeStr(taskKey)} sync started by ${actor}.`,
    };
    pushRecentEvent(
      state,
      createEvent(
        "info",
        `${safeStr(taskKey)} started`,
        `${safeStr(taskKey)} sync started by ${actor}.`
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
    state[args.taskKey] = {
      ...prev,
      status: args.status,
      requestedBy: args.actor,
      lastCompletedAt: new Date().toISOString(),
      lastMessage: args.message,
      stats: args.stats || prev.stats || {},
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

async function runAvailabilitySync(actor: string) {
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

  let cursor = 0;
  if (
    safeStr(taskState.sourceJobCompletedAt) === latestJobCompletedAt &&
    safeNum(taskState.nextCursor, 0) > 0
  ) {
    cursor = Math.max(0, safeNum(taskState.nextCursor, 0));
  }

  const batch = allSkus.slice(cursor, cursor + AVAILABILITY_BATCH_SIZE);
  if (!batch.length) {
    throw new Error("Availability sync ke liye koi pending SKU batch nahi mili.");
  }

  await markTaskRunning("availability", actor);

  const result = await syncProductAvailabilityForAllBySkuList(batch);
  const nextCursor = cursor + batch.length;
  const hasMore = nextCursor < allSkus.length;

  const message = hasMore
    ? `Availability sync batch complete. ${nextCursor}/${allSkus.length} SKUs covered.`
    : `Availability sync complete. ${allSkus.length} SKUs covered.`;

  await markTaskResult({
    taskKey: "availability",
    status: hasMore ? "pending" : "completed",
    actor,
    message,
    stats: {
      totalSourceSkus: allSkus.length,
      batchSize: batch.length,
      synced: safeNum((result as any)?.synced, 0),
      failed: safeNum((result as any)?.failed, 0),
    },
    extraPatch: {
      nextCursor: hasMore ? nextCursor : 0,
      sourceJobCompletedAt: latestJobCompletedAt,
    },
    eventTitle: "Availability sync updated",
  });

  return {
    ok: true,
    hasMore,
    result,
    message,
  };
}

async function runComboSync(actor: string) {
  const latestJob = await getLatestCompletedProductDetailsJob();
  if (!latestJob) {
    throw new Error("No completed bulk product details job found.");
  }

  const activeJob = await getLatestActiveProductDetailsJob();
  if (activeJob) {
    throw new Error("Current bulk upload abhi chal rahi hai. Combo sync baad me run karo.");
  }

  await markTaskRunning("combo", actor);

  const result = await syncAllGeneratedCombos({
    includePyq: true,
    includeGeneric: true,
  });

  const results = Array.isArray((result as any)?.results) ? (result as any).results : [];

  const message = `Combo sync complete. ${results.length} sync result bucket(s) returned.`;

  await markTaskResult({
    taskKey: "combo",
    status: "completed",
    actor,
    message,
    stats: {
      resultBuckets: results.length,
    },
    eventTitle: "Combo sync completed",
  });

  return {
    ok: true,
    result,
    message,
  };
}

async function runHardcopySync(actor: string) {
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
  const skip = Math.max(0, safeNum(taskState.nextSkip, 0));

  await markTaskRunning("hardcopy", actor);

  const result = await backfillGeneratedHardcopies({
    dryRun: false,
    limit: HARDCOPY_BATCH_SIZE,
    skip,
  });

  const summary = (result as any)?.summary || {};
  const hasMore = Boolean(summary?.hasMore);
  const nextSkip = Math.max(0, safeNum(summary?.nextSkip, 0));

  const message = hasMore
    ? `Hardcopy sync batch complete. Next skip ${nextSkip}.`
    : `Hardcopy sync complete for current eligible scope.`;

  await markTaskResult({
    taskKey: "hardcopy",
    status: hasMore ? "pending" : "completed",
    actor,
    message,
    stats: {
      processed: safeNum(summary?.processed, 0),
      created: safeNum(summary?.created, 0),
      updated: safeNum(summary?.updated, 0),
      failed: safeNum(summary?.failed, 0),
    },
    extraPatch: {
      nextSkip: hasMore ? nextSkip : 0,
    },
    eventTitle: "Hardcopy sync updated",
  });

  return {
    ok: true,
    hasMore,
    result,
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

  await markTaskRunning("fullSync", actor);

  const category = getJobCategory(latestJob);
  const hardcopyRelevant = isSolvedAssignmentsCategory(category);

  const availability = await runAvailabilitySync(actor);
  const combo = await runComboSync(actor);

  let hardcopy: any = {
    ok: true,
    skipped: true,
    message: "Hardcopy sync not relevant for latest category.",
  };

  if (hardcopyRelevant) {
    hardcopy = await runHardcopySync(actor);
  } else {
    await markTaskResult({
      taskKey: "hardcopy",
      status: "disabled",
      actor,
      message: "Latest completed upload hardcopy-relevant category ki nahi hai.",
      stats: {},
      eventTitle: "Hardcopy sync skipped",
      eventLevel: "info",
    });
  }

  const message = `Full sync run complete. Availability: ${safeStr(
    availability?.message
  )} Combo: ${safeStr(combo?.message)} Hardcopy: ${safeStr(hardcopy?.message)}`;

  await markTaskResult({
    taskKey: "fullSync",
    status: "completed",
    actor,
    message,
    stats: {
      hardcopyRelevant,
    },
    eventTitle: "Full sync completed",
  });

  return {
    ok: true,
    message,
    availability,
    combo,
    hardcopy,
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

    if (effectiveTaskKey === "availability-sync") {
      runResult = await runAvailabilitySync(actor);
    } else if (effectiveTaskKey === "combo-sync") {
      runResult = await runComboSync(actor);
    } else if (effectiveTaskKey === "hardcopy-sync") {
      runResult = await runHardcopySync(actor);
    } else if (effectiveTaskKey === "run-all-post-syncs") {
      runResult = await runFullSync(actor);
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
        taskKey === "availability-sync"
          ? "availability"
          : taskKey === "combo-sync"
          ? "combo"
          : taskKey === "hardcopy-sync"
          ? "hardcopy"
          : taskKey === "run-all-post-syncs"
          ? "fullSync"
          : taskKey === "auto-run"
          ? "fullSync"
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