import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getAuthUser, hasPermission } from "@/lib/auth";

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

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
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
      res: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
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

  let body: any = {};
  try {
    body = parseJsonBody(await req.json());
  } catch {
    return badRequest("Invalid JSON body");
  }

  const action = safeStr(body?.action).toLowerCase();
  const blockNumber = Math.max(1, Math.trunc(safeNum(body?.blockNumber, 1)));
  const totalBlocks = Math.max(1, Math.trunc(safeNum(body?.totalBlocks, 1)));

  if (action === "init") {
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return badRequest("items required for init");
    }

    const blockId = buildBlockId(
      `${safeStr(guard.user.email)}-${blockNumber}-${Date.now()}`
    );

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

      const originalName = cleanBaseFileName(
        item?.originalName || item?.fileName || ""
      );
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

      const originalName = cleanBaseFileName(
        item?.originalName || item?.fileName || ""
      );
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

  return badRequest("Unsupported action");
}