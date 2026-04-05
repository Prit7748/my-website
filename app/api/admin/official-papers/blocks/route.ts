import crypto from "crypto";
import { NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import { uploadPdfBufferToS3, getPdfBufferFromS3 } from "@/lib/pdfVault";

export const runtime = "nodejs";

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

function isProbablyPdfBuffer(buf: Buffer) {
  if (!buf || !buf.length) return false;
  const header = buf.subarray(0, Math.min(buf.length, 8)).toString("latin1");
  return header.includes("%PDF");
}

type FileLike = {
  name: string;
  size?: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isFileLike(value: any): value is FileLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.name === "string" &&
      typeof value.arrayBuffer === "function"
  );
}

async function stagePdfViaExistingVaultS3(args: {
  originalName: string;
  pdfBuffer: Buffer;
  blockId: string;
  rowNumber: number;
}) {
  const originalName = cleanBaseFileName(args.originalName);

  if (!originalName || !isPdfFileName(originalName)) {
    throw new Error("Only PDF files allowed");
  }

  if (!args.pdfBuffer?.length) {
    throw new Error("Empty PDF file");
  }

  if (!isProbablyPdfBuffer(args.pdfBuffer)) {
    throw new Error("Uploaded file is not a valid PDF binary");
  }

  const folderPath = `_staging/official-papers/direct-blocks/${safeStr(args.blockId)}`;

  const uploaded = await uploadPdfBufferToS3({
    folderPath,
    originalName,
    bytes: args.pdfBuffer,
    mimeType: "application/pdf",
  });

  const verifyBytes = await getPdfBufferFromS3(safeStr(uploaded.key));
  if (!verifyBytes?.length) {
    throw new Error("Uploaded staged PDF not found or empty after upload");
  }

  return {
    bucket: safeStr(uploaded.bucket),
    key: safeStr(uploaded.key),
    originalName,
    fileName: originalName,
    sizeBytes: verifyBytes.length,
  };
}

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  const contentType = safeStr(req.headers.get("content-type")).toLowerCase();
  const userEmail = safeStr(guard.user.email);

  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Only multipart/form-data is supported for official papers block upload", {
      receivedContentType: contentType || "(empty)",
    });
  }

  try {
    const formData = await req.formData();

    const rawEntries = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
      ...formData.getAll("pdfs"),
    ];

    const seen = new Set<any>();
    const files: FileLike[] = [];

    for (const entry of rawEntries) {
      if (!entry || seen.has(entry)) continue;
      seen.add(entry);
      if (isFileLike(entry)) {
        files.push(entry);
      }
    }

    if (!files.length) {
      return badRequest("At least one PDF file is required", {
        receivedFields: Array.from(formData.keys()),
        probableReason:
          "Frontend file field name mismatch or multipart parser did not receive files",
      });
    }

    let meta: any[] = [];
    try {
      const rawMeta = safeStr(formData.get("meta"));
      meta = rawMeta ? JSON.parse(rawMeta) : [];
      if (!Array.isArray(meta)) meta = [];
    } catch {
      meta = [];
    }

    const blockNumber = Math.max(
      1,
      Math.trunc(safeNum(formData.get("blockNumber"), 1))
    );
    const totalBlocks = Math.max(
      1,
      Math.trunc(safeNum(formData.get("totalBlocks"), 1))
    );
    const blockId = buildBlockId(`${userEmail}-${blockNumber}-${Date.now()}`);

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
        metaRow?.clientFileId || `${fileName}__${safeNum(file.size, 0)}__${i}`
      );

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

      try {
        const pdfBuffer = Buffer.from(await file.arrayBuffer());

        const staged = await stagePdfViaExistingVaultS3({
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
          reason: safeStr(error?.message || "Stage upload failed"),
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Official papers block ${blockNumber}/${totalBlocks} staged. Success ${items.length}, Failed ${failures.length}.`,
        action: "multipart-staged-via-existing-s3-helper",
        blockId,
        blockNumber,
        totalBlocks,
        items,
        failures,
      },
      { status: 200 }
    );
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