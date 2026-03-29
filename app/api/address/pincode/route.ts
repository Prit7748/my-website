import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function normalizePincode(input: any) {
  return safeStr(input).replace(/\D/g, "").slice(0, 6);
}

function uniqueBy<T>(arr: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const pincode = normalizePincode(req.nextUrl.searchParams.get("pincode"));

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { ok: false, error: "Valid 6 digit pincode required." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const raw = await upstream.json().catch(() => null);
    const root = Array.isArray(raw) ? raw[0] : null;

    if (!root) {
      return NextResponse.json(
        { ok: false, error: "Pincode service returned invalid response." },
        { status: 502 }
      );
    }

    const postOfficesRaw = Array.isArray(root?.PostOffice) ? root.PostOffice : [];

    const postOffices = uniqueBy(
      postOfficesRaw
        .map((po: any) => ({
          name: safeStr(po?.Name),
          branchType: safeStr(po?.BranchType),
          deliveryStatus: safeStr(po?.DeliveryStatus),
          district: safeStr(po?.District),
          state: safeStr(po?.State),
          block: safeStr(po?.Block),
          division: safeStr(po?.Division),
          region: safeStr(po?.Region),
          circle: safeStr(po?.Circle),
          country: safeStr(po?.Country || "India"),
        }))
        .filter((po: any) => po.name),
      (po: any) => `${po.name}|${po.district}|${po.state}|${po.branchType}`
    );

    if (!postOffices.length) {
      return NextResponse.json(
        {
          ok: false,
          error: safeStr(root?.Message || "No address data found for this pincode."),
          pincode,
        },
        { status: 404 }
      );
    }

    const first = postOffices[0];

    return NextResponse.json(
      {
        ok: true,
        pincode,
        city: safeStr(first?.district),
        district: safeStr(first?.district),
        state: safeStr(first?.state),
        region: safeStr(first?.region),
        circle: safeStr(first?.circle),
        postOffices,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(e?.message || "Pincode lookup failed."),
      },
      { status: 500 }
    );
  }
}