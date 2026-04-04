import crypto from "crypto";
import { NextResponse } from "next/server";

import { getAuthUser, hasPermission } from "@/lib/auth";
import { uploadOfficialPaperBlockPdfToS3 } from "@/lib/bulkOfficialPapersJob";

export const runtime = "nodejs";

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

function parseMetaJson(input: string) {
  try {
    const parsed = JSON.parse(input || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

export async function POST(req: Request) {
  const guard = await assertAdminWriteAccess();
  if (!guard.ok) return guard.res;

  try {
    const formData = await req.formData();

    const fileEntries = formData.getAll("files");
    const files = fileEntries.filter((item): item is File => item instanceof File);

    if (!files.length) {
      return badRequest("At least one PDF file is required");
    }

    const meta = parseMetaJson(safeStr(formData.get("meta")));
    const requestedBlockNumber = Math.max(
      1,
      Math.trunc(safeNum(formData.get("blockNumber"), 1))
    );
    const totalBlocks = Math.max(
      1,
      Math.trunc(safeNum(formData.get("totalBlocks"), 1))
    );

    const blockId = buildBlockId(
      `${safeStr(guard.user.email)}-${requestedBlockNumber}-${Date.now()}`
    );

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

      const originalName = safeStr(metaRow?.originalName || file.name);
      const fileName = safeStr(metaRow?.fileName || file.name || originalName);
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

      if (!file || typeof file.arrayBuffer !== "function") {
        failures.push({
          clientFileId,
          fileName,
          reason: "Invalid file payload",
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
          reason: safeStr(error?.message || "Stage upload failed"),
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Block ${requestedBlockNumber}/${totalBlocks} staged. Success ${items.length}, Failed ${failures.length}.`,
        blockId,
        blockNumber: requestedBlockNumber,
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
        error: safeStr(error?.message || "Failed to stage block PDFs"),
      },
      { status: 500 }
    );
  }
}