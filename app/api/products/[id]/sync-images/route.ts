// app/api/admin/products/[id]/sync-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";

function fileNameOf(urlOrPath: string) {
  const clean = (urlOrPath || "").split("?")[0];
  const parts = clean.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function makeSortKey(img: any) {
  // Prefer existing sortKey; else derive from filename; else from url
  const existing = (img?.sortKey || "").toString().trim().toLowerCase();
  if (existing) return existing;

  const fn = (img?.filename || "").toString().trim().toLowerCase();
  if (fn) return fn;

  const u = (img?.url || "").toString().trim();
  return fileNameOf(u);
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await dbConnect();

    const id = ctx?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing product id in URL" }, { status: 400 });
    }

    const product: any = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Ensure images is always an array
    if (!Array.isArray(product.images)) product.images = [];

    // Normalize each image doc: ensure filename & sortKey exist and are stable
    product.images = product.images
      .filter((img: any) => img && typeof img === "object" && img.url) // keep only valid
      .map((img: any) => {
        const filename = (img.filename || fileNameOf(img.url) || "").toLowerCase();
        const sortKey = makeSortKey({ ...img, filename });
        return {
          ...img,
          filename,
          sortKey,
          alt: typeof img.alt === "string" ? img.alt : "",
        };
      });

    // This sorts by sortKey + sets thumbKey/quickKey (your model method)
    if (typeof product.normalizeImages === "function") {
      product.normalizeImages();
    } else {
      // fallback (shouldn't happen)
      product.images = product.images.sort((a: any, b: any) =>
        (a.sortKey || "").localeCompare(b.sortKey || "")
      );
      const first = product.images[0];
      const second = product.images[1] || first;
      product.thumbKey = first?.key || "";
      product.quickKey = second?.key || "";
    }

    await product.save();

    return NextResponse.json({
      ok: true,
      productId: product._id,
      imagesCount: product.images.length,
      thumbKey: product.thumbKey,
      quickKey: product.quickKey,
      // Helpful debug (first two)
      first2: product.images.slice(0, 2).map((x: any) => ({
        key: x.key,
        filename: x.filename,
        sortKey: x.sortKey,
        url: x.url,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "sync-images failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
