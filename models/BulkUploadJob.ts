import { Schema, models, model } from "mongoose";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : def;
}

const FailureRowSchema = new Schema(
  {
    itemIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    rowNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    batchNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    identifier: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    sku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    fileName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      default: "failed",
      trim: true,
      maxlength: 40,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },
    raw: {
      type: Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false, minimize: true }
);

const ProgressSchema = new Schema(
  {
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    processedItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    successItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    skippedItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    validItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    batchSize: {
      type: Number,
      default: 100,
      min: 1,
    },
    batchCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentBatchNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastProcessedIndex: {
      type: Number,
      default: -1,
      min: -1,
    },
  },
  { _id: false, minimize: true }
);

const LastBatchSchema = new Schema(
  {
    batchNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    fromIndex: {
      type: Number,
      default: -1,
      min: -1,
    },
    toIndex: {
      type: Number,
      default: -1,
      min: -1,
    },
    attempted: {
      type: Number,
      default: 0,
      min: 0,
    },
    success: {
      type: Number,
      default: 0,
      min: 0,
    },
    failed: {
      type: Number,
      default: 0,
      min: 0,
    },
    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
  },
  { _id: false, minimize: true }
);

const BulkUploadJobSchema = new Schema(
  {
    jobType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },

    jobLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    status: {
      type: String,
      enum: [
        "queued",
        "running",
        "processing_batch",
        "completed",
        "completed_with_errors",
        "failed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },

    createdBy: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },

    config: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },

    input: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },

    summary: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },

    progress: {
      type: ProgressSchema,
      default: () => ({}),
    },

    lastBatch: {
      type: LastBatchSchema,
      default: () => ({}),
    },

    failures: {
      type: [FailureRowSchema],
      default: () => [],
    },

    resultMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 8000,
    },

    downloadFileName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    lockToken: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    lockExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
      index: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastHeartbeatAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

BulkUploadJobSchema.pre("save", function () {
  const doc = this as any;

  doc.jobType = safeStr(doc.jobType);
  doc.jobLabel = safeStr(doc.jobLabel);
  doc.status = safeStr(doc.status);
  doc.createdBy = safeStr(doc.createdBy);
  doc.resultMessage = safeStr(doc.resultMessage);
  doc.downloadFileName = safeStr(doc.downloadFileName);
  doc.lockToken = safeStr(doc.lockToken);

  if (!doc.meta || typeof doc.meta !== "object" || Array.isArray(doc.meta)) {
    doc.meta = {};
  }

  if (!doc.config || typeof doc.config !== "object" || Array.isArray(doc.config)) {
    doc.config = {};
  }

  if (!doc.input || typeof doc.input !== "object" || Array.isArray(doc.input)) {
    doc.input = {};
  }

  if (!doc.summary || typeof doc.summary !== "object" || Array.isArray(doc.summary)) {
    doc.summary = {};
  }

  if (!doc.progress) doc.progress = {};

  doc.progress.totalItems = safeNum(doc.progress.totalItems, 0);
  doc.progress.processedItems = Math.min(
    safeNum(doc.progress.processedItems, 0),
    doc.progress.totalItems
  );
  doc.progress.successItems = safeNum(doc.progress.successItems, 0);
  doc.progress.failedItems = safeNum(doc.progress.failedItems, 0);
  doc.progress.skippedItems = safeNum(doc.progress.skippedItems, 0);
  doc.progress.validItems = safeNum(doc.progress.validItems, 0);
  doc.progress.batchSize = Math.max(1, safeNum(doc.progress.batchSize, 100));
  doc.progress.batchCount =
    doc.progress.totalItems > 0
      ? Math.ceil(doc.progress.totalItems / doc.progress.batchSize)
      : 0;
  doc.progress.currentBatchNumber = safeNum(doc.progress.currentBatchNumber, 0);
  doc.progress.lastProcessedIndex = Math.max(
    -1,
    Math.trunc(Number(doc.progress.lastProcessedIndex ?? -1))
  );

  if (!doc.lastBatch) doc.lastBatch = {};

  doc.lastBatch.batchNumber = safeNum(doc.lastBatch.batchNumber, 0);
  doc.lastBatch.fromIndex = Math.max(
    -1,
    Math.trunc(Number(doc.lastBatch.fromIndex ?? -1))
  );
  doc.lastBatch.toIndex = Math.max(-1, Math.trunc(Number(doc.lastBatch.toIndex ?? -1)));
  doc.lastBatch.attempted = safeNum(doc.lastBatch.attempted, 0);
  doc.lastBatch.success = safeNum(doc.lastBatch.success, 0);
  doc.lastBatch.failed = safeNum(doc.lastBatch.failed, 0);
  doc.lastBatch.skipped = safeNum(doc.lastBatch.skipped, 0);
  doc.lastBatch.note = safeStr(doc.lastBatch.note).slice(0, 2000);

  if (!Array.isArray(doc.failures)) doc.failures = [];

  doc.failures = doc.failures.map((row: any) => ({
    itemIndex: safeNum(row?.itemIndex, 0),
    rowNumber: safeNum(row?.rowNumber, 0),
    batchNumber: safeNum(row?.batchNumber, 0),
    identifier: safeStr(row?.identifier),
    sku: safeStr(row?.sku).toUpperCase(),
    fileName: safeStr(row?.fileName),
    status: safeStr(row?.status || "failed"),
    reason: safeStr(row?.reason).slice(0, 3000),
    raw:
      row?.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? row.raw
        : null,
    createdAt: row?.createdAt || new Date(),
  }));
});

BulkUploadJobSchema.index(
  { jobType: 1, status: 1, createdAt: -1 },
  { name: "bulkjob_type_status_created_idx" }
);

BulkUploadJobSchema.index(
  { createdBy: 1, status: 1, createdAt: -1 },
  { name: "bulkjob_createdby_status_created_idx" }
);

BulkUploadJobSchema.index(
  { createdBy: 1, jobType: 1, createdAt: -1 },
  { name: "bulkjob_createdby_type_created_idx" }
);

export default models.BulkUploadJob || model("BulkUploadJob", BulkUploadJobSchema);