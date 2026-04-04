import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getAuthUser, hasPermission } from "@/lib/auth";
import { uploadOfficialPaperBlockPdfToS3 } from "@/lib/bulkOfficialPapersJob";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION || "ap-south-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_PRIVATE = process.env.AWS_S3_BUCKET_PRIVATE || "";
const STAGING_DIRECT_PREFIX = "bulk-staging/official-papers/direct-blocks";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function badRequest(message: string, extra?: Record<string, any>) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra || {}) },
    { status: 400 }
  );
}

async function assertAdminWriteAccess() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user, "products:write")) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user };
}

function cleanBaseFileName(name: string) {
  return safeStr(name).split(/[\\/]/).pop() || "";
}

function isPdfFileName(name: string) {
  return cleanBaseFileName(name).toLowerCase().endsWith(".pdf");
}

function buildSafeFileStem(input: string, fallback = "file") {
  return (
    cleanBaseFileName(input)
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || fallback
  );
}

function buildBlockId(input?: string) {
  const clean =
    safeStr(input)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "";

  if (clean) return clean;
  return `block-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

function buildStagedDirectPdfKey(args: {
  originalName: string;
  blockId: string;
  rowNumber: number;
}) {
  const rand = crypto.randomBytes(8).toString("hex");
  const safeBase = buildSafeFileStem(args.originalName, "file");
  const rowPart = Math.max(1, Math.trunc(Number(args.rowNumber || 1)));

  return `${STAGING_DIRECT_PREFIX}/${args.blockId}/${Date.now()}-${rowPart}-${rand}-${safeBase}.pdf`;
}

function parseJsonBody(body: any) {
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

type InitItem = {
  clientFileId?: string;
  originalName?: string;
  fileName?: string;
  sizeBytes?: number;
};

type FinalizeItem = {
  clientFileId?: string;
  originalName?: string;
  fileName?: string;
  sizeBytes?: number;
  stagedPdfKey?: string;
  stagedBucket?: string;
  blockId?: string;
};

async function buildSignedUploadUrl(args: {
  key: string;
  contentType?: string;
}) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_PRIVATE,
    Key: args.key,
    ContentType: safeStr(args.contentType || "application/pdf"),
  });

  return getSignedUrl(s3, command, { expiresIn: 15 * 60 });
}

async function handleJsonMode(req: Request, userEmail: string) {
  let body: any = {};
  try {
    body = parseJsonBody(await req.json());
  } catch {
    return badRequest("Invalid JSON body", {
      expectedMode: "application/json",
      probableReason:
        "Frontend old bundle may still be sending multipart/form-data",
    });
  }

  const action = safeStr(body?.action).toLowerCase();
  const blockNumber = Math.max(1, Math.trunc(safeNum(body?.blockNumber, 1)));
  const totalBlocks = Math.max(1, Math.trunc(safeNum(body?.totalBlocks, 1)));

  if (action === "init") {
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return badRequest("items required for init");
    }

    const blockId = buildBlockId(`${safeStr(userEmail)}-${blockNumber}-${Date.now()}`);

    const uploads: Array<{
      clientFileId: string;
      originalName: string;
      fileName: string;
      sizeBytes: number;
      stagedPdfKey: string;
      stagedBucket: string;
      blockId: string;
      uploadUrl: string;
      headers: Record<string, string>;
    }> = [];

    const failures: Array<{
      clientFileId?: string;
      fileName?: string;
      reason?: string;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as InitItem;

      const originalName = cleanBaseFileName(item?.originalName || item?.fileName || "");
      const fileName = cleanBaseFileName(item?.fileName || originalName);
      const clientFileId = safeStr(
        item?.clientFileId || `${fileName}__${safeNum(item?.sizeBytes, 0)}__${i}`
      );
      const sizeBytes = Math.max(0, Math.trunc(safeNum(item?.sizeBytes, 0)));

      if (!originalName || !fileName) {
        failures.push({
          clientFileId,
          fileName,
          reason: "File name missing",
        });
        continue;
      }

      if (!isPdfFileName(fileName)) {
        failures.push({
          clientFileId,
          fileName,
          reason: "Only PDF files allowed",
        });
        continue;
      }

      if (sizeBytes <= 0) {
        failures.push({
          clientFileId,
          fileName,
          reason: "Invalid file size",
        });
        continue;
      }

      const stagedPdfKey = buildStagedDirectPdfKey({
        originalName: fileName,
        blockId,
        rowNumber: i + 1,
      });

      const uploadUrl = await buildSignedUploadUrl({
        key: stagedPdfKey,
        contentType: "application/pdf",
      });

      uploads.push({
        clientFileId,
        originalName,
        fileName,
        sizeBytes,
        stagedPdfKey,
        stagedBucket: BUCKET_PRIVATE,
        blockId,
        uploadUrl,
        headers: {
          "Content-Type": "application/pdf",
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Block ${blockNumber}/${totalBlocks} upload URLs generated. Ready ${uploads.length}, Failed ${failures.length}.`,
        action: "init",
        blockId,
        blockNumber,
        totalBlocks,
        uploads,
        failures,
      },
      { status: 200 }
    );
  }

  if (action === "finalize") {
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return badRequest("items required for finalize");
    }

    const stagedItems: Array<{
      clientFileId: string;
      originalName: string;
      fileName: string;
      sizeBytes: number;
      stagedPdfKey: string;
      stagedBucket: string;
      blockId: string;
    }> = [];

    const failures: Array<{
      clientFileId?: string;
      fileName?: string;
      reason?: string;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as FinalizeItem;

      const originalName = cleanBaseFileName(item?.originalName || item?.fileName || "");
      const fileName = cleanBaseFileName(item?.fileName || originalName);
      const clientFileId = safeStr(item?.clientFileId);
      const stagedPdfKey = safeStr(item?.stagedPdfKey);
      const stagedBucket = safeStr(item?.stagedBucket || BUCKET_PRIVATE);
      const blockId = safeStr(item?.blockId);
      const sizeBytes = Math.max(0, Math.trunc(safeNum(item?.sizeBytes, 0)));

      if (!clientFileId || !fileName || !stagedPdfKey || !blockId) {
        failures.push({
          clientFileId,
          fileName,
          reason: "Finalize metadata incomplete",
        });
        continue;
      }

      try {
        const head = await s3.send(
          new HeadObjectCommand({
            Bucket: stagedBucket,
            Key: stagedPdfKey,
          })
        );

        const remoteSize = Math.max(
          0,
          Math.trunc(safeNum((head as any)?.ContentLength, 0))
        );

        if (remoteSize <= 0) {
          failures.push({
            clientFileId,
            fileName,
            reason: "Uploaded staged PDF not found or empty",
          });
          continue;
        }

        stagedItems.push({
          clientFileId,
          originalName,
          fileName,
          sizeBytes: remoteSize || sizeBytes,
          stagedPdfKey,
          stagedBucket,
          blockId,
        });
      } catch (error: any) {
        failures.push({
          clientFileId,
          fileName,
          reason: safeStr(error?.message || "Failed to verify staged PDF"),
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Block ${blockNumber}/${totalBlocks} finalized. Success ${stagedItems.length}, Failed ${failures.length}.`,
        action: "finalize",
        blockNumber,
        totalBlocks,
        items: stagedItems,
        failures,
      },
      { status: 200 }
    );
  }

  return badRequest("Unsupported JSON action");
}

async function handleMultipartFallback(req: Request, userEmail: string) {
  const formData = await req.formData();

  const fileEntries = formData.getAll("files");
  const files = fileEntries.filter((item): item is File => item instanceof File);

  if (!files.length) {
    return badRequest("At least one PDF file is required in multipart mode");
  }

  let meta: any[] = [];
  try {
    const rawMeta = safeStr(formData.get("meta"));
    meta = rawMeta ? JSON.parse(rawMeta) : [];
    if (!Array.isArray(meta)) meta = [];
  } catch {
    meta = [];
  }

  const blockNumber = Math.max(1, Math.trunc(safeNum(formData.get("blockNumber"), 1)));
  const totalBlocks = Math.max(1, Math.trunc(safeNum(formData.get("totalBlocks"), 1)));
  const blockId = buildBlockId(`${safeStr(userEmail)}-${blockNumber}-${Date.now()}`);

  const items: Array<{
    clientFileId: string;
    originalName: string;
    fileName: string;
    sizeBytes: number;
    stagedPdfKey: string;
    stagedBucket?: string;
    blockId: string;
  }> = [];

  const failures: Array<{
    clientFileId?: string;
    fileName?: string;
    reason?: string;
  }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const metaRow = meta[i] || {};

    const originalName = cleanBaseFileName(metaRow?.originalName || file.name);
    const fileName = cleanBaseFileName(metaRow?.fileName || file.name || originalName);
    const clientFileId = safeStr(
      metaRow?.clientFileId || `${fileName}__${file.size}__${i}`
    );

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      failures.push({
        clientFileId,
        fileName,
        reason: "Only PDF files allowed",
      });
      continue;
    }

    try {
      const pdfBuffer = Buffer.from(await file.arrayBuffer());

      if (!pdfBuffer.length) {
        failures.push({
          clientFileId,
          fileName,
          reason: "Empty PDF file",
        });
        continue;
      }

      const staged = await uploadOfficialPaperBlockPdfToS3({
        originalName,
        pdfBuffer,
        blockId,
        rowNumber: i + 1,
      });

      items.push({
        clientFileId,
        originalName: staged.originalName,
        fileName: staged.fileName,
        sizeBytes: Number(staged.sizeBytes || pdfBuffer.length),
        stagedPdfKey: safeStr(staged.key),
        stagedBucket: safeStr(staged.bucket),
        blockId,
      });
    } catch (error: any) {
      failures.push({
        clientFileId,
        fileName,
        reason: safeStr(error?.message || "Multipart fallback stage upload failed"),
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      message: `Fallback multipart block ${blockNumber}/${totalBlocks} staged. Success ${items.length}, Failed ${failures.length}.`,
      action: "multipart-fallback",
      blockId,
      blockNumber,
      totalBlocks,
      items,
      failures,
      warning:
        "Old frontend multipart mode detected. Large uploads ke liye latest signed-upload frontend use karo.",
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  if (!ACCESS_KEY || !SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "AWS credentials missing" },
      { status: 500 }
    );
  }

  if (!BUCKET_PRIVATE) {
    return NextResponse.json(
      { ok: false, error: "AWS_S3_BUCKET_PRIVATE missing" },
      { status: 500 }
    );
  }

  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();
  const userEmail = safeStr(guard.user.email);

  try {
    if (contentType.includes("application/json")) {
      return await handleJsonMode(req, userEmail);
    }

    if (contentType.includes("multipart/form-data")) {
      return await handleMultipartFallback(req, userEmail);
    }

    return badRequest("Unsupported content type", {
      receivedContentType: contentType || "(empty)",
      expectedContentTypes: ["application/json", "multipart/form-data"],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message || "Failed to handle block upload"),
      },
      { status: 500 }
    );
  }
}