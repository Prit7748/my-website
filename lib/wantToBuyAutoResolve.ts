import mongoose from "mongoose";
import WantToBuy from "@/models/WantToBuy";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normAvail(v?: string) {
  return safeStr(v).toLowerCase();
}

export async function autoResolveWantToBuyForProduct(input: {
  productId: any;
  availability?: string;
  pdfKey?: string;
  isActive?: boolean;
}) {
  const productId = safeStr(input?.productId);
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return {
      ok: false,
      reason: "invalid_product_id",
      deletedCount: 0,
      emails: [] as string[],
    };
  }

  const availability = normAvail(input?.availability);
  const hasPdf = !!safeStr(input?.pdfKey);
  const isActive = Boolean(input?.isActive);

  const shouldResolve = (availability === "available" || hasPdf) && isActive;

  if (!shouldResolve) {
    return {
      ok: true,
      reason: "not_available_yet",
      deletedCount: 0,
      emails: [] as string[],
    };
  }

  const rows = await WantToBuy.find({
    productId: new mongoose.Types.ObjectId(productId),
  })
    .select("userEmail")
    .lean();

  const emails = Array.from(
    new Set(
      (rows || [])
        .map((x: any) => safeStr(x?.userEmail).toLowerCase())
        .filter(Boolean)
    )
  );

  const del = await WantToBuy.deleteMany({
    productId: new mongoose.Types.ObjectId(productId),
  });

  return {
    ok: true,
    reason: "resolved_and_deleted",
    deletedCount: Number(del?.deletedCount || 0),
    emails,
  };
}