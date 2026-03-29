import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import Order from "@/models/Order";

export const runtime = "nodejs";

type SourceBucketRow = {
  sourceBucket: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type DetectedSourceRow = {
  detectedSource: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type UtmSourceRow = {
  utmSource: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type UtmMediumRow = {
  utmMedium: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type UtmCampaignRow = {
  utmCampaign: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type ReferrerRow = {
  referrerHost: string;
  orderCount: number;
  revenue: number;
  orderSharePct: number;
  revenueSharePct: number;
};

type DailyTrendRow = {
  day: string;
  orderCount: number;
  revenue: number;
};

type RecentOrderRow = {
  orderId: string;
  orderRef: string;
  paidAt: string | null;
  totalAmount: number;
  sourceBucket: string;
  detectedSource: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrerHost: string;
  hasAnalytics: boolean;
  itemCount: number;
};

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Math.round((safeNum(n, 0) + Number.EPSILON) * 100) / 100;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildCoalesce(paths: string[], fallback: any) {
  return paths.reduceRight<any>((acc, path) => ({ $ifNull: [path, acc] }), fallback);
}

function toPct(part: number, total: number) {
  if (!total) return 0;
  return round2((part / total) * 100);
}

function labelOrFallback(v: any, fallback = "unknown") {
  const s = safeStr(v);
  return s || fallback;
}

function sortByCountDesc<T extends { orderCount: number; revenue: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const c = safeNum(b.orderCount, 0) - safeNum(a.orderCount, 0);
    if (c !== 0) return c;
    return safeNum(b.revenue, 0) - safeNum(a.revenue, 0);
  });
}

function normalizeBucketLabel(bucket: string) {
  const v = safeStr(bucket).toLowerCase();

  if (!v) return "unknown";
  if (v === "google") return "google";
  if (v === "youtube") return "youtube";
  if (v === "instagram") return "instagram";
  if (v === "whatsapp") return "whatsapp";
  if (v === "facebook") return "facebook";
  if (v === "referral") return "referral";
  if (v === "direct") return "direct";
  if (v === "other") return "other";
  return v;
}

export async function GET(req: NextRequest) {
  try {
    const authUser: any = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const role = safeStr(authUser?.role).toLowerCase();
    if (role !== "master_admin" && role !== "co_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const days = clamp(safeNum(sp.get("days"), 30), 7, 365);
    const top = clamp(safeNum(sp.get("top"), 8), 3, 25);
    const recentLimit = clamp(safeNum(sp.get("recent"), 15), 0, 50);

    const now = new Date();
    const since = startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));

    await dbConnect();

    const sourceBucketExpr = buildCoalesce(
      ["$meta.analytics.lastTouch.source_bucket", "$meta.analytics.firstTouch.source_bucket"],
      "unknown"
    );

    const detectedSourceExpr = buildCoalesce(
      ["$meta.analytics.lastTouch.detected_source", "$meta.analytics.firstTouch.detected_source"],
      "unknown"
    );

    const utmSourceExpr = buildCoalesce(
      ["$meta.analytics.lastTouch.utm_source", "$meta.analytics.firstTouch.utm_source"],
      ""
    );

    const utmMediumExpr = buildCoalesce(
      ["$meta.analytics.lastTouch.utm_medium", "$meta.analytics.firstTouch.utm_medium"],
      ""
    );

    const utmCampaignExpr = buildCoalesce(
      ["$meta.analytics.lastTouch.utm_campaign", "$meta.analytics.firstTouch.utm_campaign"],
      ""
    );

    const referrerHostExpr = buildCoalesce(
      ["$meta.analytics.lastTouch.referrer_host", "$meta.analytics.firstTouch.referrer_host"],
      ""
    );

    const pipeline: any[] = [
      {
        $match: {
          status: "paid",
          paidAt: { $gte: since },
        },
      },
      {
        $addFields: {
          __sourceBucket: sourceBucketExpr,
          __detectedSource: detectedSourceExpr,
          __utmSource: utmSourceExpr,
          __utmMedium: utmMediumExpr,
          __utmCampaign: utmCampaignExpr,
          __referrerHost: referrerHostExpr,
          __orderRevenue: { $ifNull: ["$totalAmount", 0] },
          __paidDay: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paidAt",
            },
          },
        },
      },
      {
        $addFields: {
          __hasAnalytics: {
            $cond: [
              {
                $or: [
                  { $ne: ["$__utmSource", ""] },
                  { $ne: ["$__utmMedium", ""] },
                  { $ne: ["$__utmCampaign", ""] },
                  { $ne: ["$__referrerHost", ""] },
                  { $ne: ["$__sourceBucket", "unknown"] },
                  { $ne: ["$__detectedSource", "unknown"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$__orderRevenue" },
                attributedOrders: { $sum: "$__hasAnalytics" },
                unattributedOrders: {
                  $sum: {
                    $cond: [{ $eq: ["$__hasAnalytics", 0] }, 1, 0],
                  },
                },
              },
            },
          ],

          sourceBuckets: [
            {
              $group: {
                _id: "$__sourceBucket",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $project: {
                _id: 0,
                sourceBucket: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          detectedSources: [
            {
              $group: {
                _id: "$__detectedSource",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $project: {
                _id: 0,
                detectedSource: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          utmSources: [
            {
              $match: {
                __utmSource: { $ne: "" },
              },
            },
            {
              $group: {
                _id: "$__utmSource",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $project: {
                _id: 0,
                utmSource: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          utmMediums: [
            {
              $match: {
                __utmMedium: { $ne: "" },
              },
            },
            {
              $group: {
                _id: "$__utmMedium",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $project: {
                _id: 0,
                utmMedium: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          utmCampaigns: [
            {
              $match: {
                __utmCampaign: { $ne: "" },
              },
            },
            {
              $group: {
                _id: "$__utmCampaign",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $project: {
                _id: 0,
                utmCampaign: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          referrers: [
            {
              $match: {
                __referrerHost: { $ne: "" },
              },
            },
            {
              $group: {
                _id: "$__referrerHost",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $project: {
                _id: 0,
                referrerHost: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          dailyTrend: [
            {
              $group: {
                _id: "$__paidDay",
                orderCount: { $sum: 1 },
                revenue: { $sum: "$__orderRevenue" },
              },
            },
            {
              $sort: { _id: 1 },
            },
            {
              $project: {
                _id: 0,
                day: "$_id",
                orderCount: 1,
                revenue: 1,
              },
            },
          ],

          recentOrders:
            recentLimit > 0
              ? [
                  { $sort: { paidAt: -1, createdAt: -1 } },
                  { $limit: recentLimit },
                  {
                    $project: {
                      _id: 0,
                      orderId: { $toString: "$_id" },
                      orderRef: { $ifNull: ["$orderRef", ""] },
                      paidAt: 1,
                      totalAmount: "$__orderRevenue",
                      sourceBucket: "$__sourceBucket",
                      detectedSource: "$__detectedSource",
                      utmSource: "$__utmSource",
                      utmMedium: "$__utmMedium",
                      utmCampaign: "$__utmCampaign",
                      referrerHost: "$__referrerHost",
                      hasAnalytics: "$__hasAnalytics",
                      itemCount: {
                        $size: {
                          $ifNull: ["$items", []],
                        },
                      },
                    },
                  },
                ]
              : [],
        },
      },
    ];

    const agg = await Order.aggregate(pipeline);
    const raw = Array.isArray(agg) && agg[0] ? agg[0] : {};

    const overviewRaw = Array.isArray(raw?.overview) && raw.overview[0] ? raw.overview[0] : null;

    const overview = {
      totalOrders: safeNum(overviewRaw?.totalOrders, 0),
      totalRevenue: round2(safeNum(overviewRaw?.totalRevenue, 0)),
      attributedOrders: safeNum(overviewRaw?.attributedOrders, 0),
      unattributedOrders: safeNum(overviewRaw?.unattributedOrders, 0),
    };

    const sourceBucketsBase: Array<{
      sourceBucket: string;
      orderCount: number;
      revenue: number;
    }> = sortByCountDesc<{ sourceBucket: string; orderCount: number; revenue: number }>(
      (Array.isArray(raw?.sourceBuckets) ? raw.sourceBuckets : []).map((x: any) => ({
        sourceBucket: normalizeBucketLabel(x?.sourceBucket),
        orderCount: safeNum(x?.orderCount, 0),
        revenue: round2(safeNum(x?.revenue, 0)),
      }))
    );

    const sourceBuckets: SourceBucketRow[] = sourceBucketsBase
      .map((x) => ({
        sourceBucket: x.sourceBucket,
        orderCount: x.orderCount,
        revenue: x.revenue,
        orderSharePct: toPct(x.orderCount, overview.totalOrders),
        revenueSharePct: toPct(x.revenue, overview.totalRevenue),
      }))
      .slice(0, top);

    const detectedSources: DetectedSourceRow[] = sortByCountDesc<DetectedSourceRow>(
      (Array.isArray(raw?.detectedSources) ? raw.detectedSources : []).map((x: any) => ({
        detectedSource: labelOrFallback(x?.detectedSource, "unknown"),
        orderCount: safeNum(x?.orderCount, 0),
        revenue: round2(safeNum(x?.revenue, 0)),
        orderSharePct: toPct(safeNum(x?.orderCount, 0), overview.totalOrders),
        revenueSharePct: toPct(safeNum(x?.revenue, 0), overview.totalRevenue),
      }))
    ).slice(0, top);

    const utmSources: UtmSourceRow[] = sortByCountDesc<UtmSourceRow>(
      (Array.isArray(raw?.utmSources) ? raw.utmSources : []).map((x: any) => ({
        utmSource: labelOrFallback(x?.utmSource, "unknown"),
        orderCount: safeNum(x?.orderCount, 0),
        revenue: round2(safeNum(x?.revenue, 0)),
        orderSharePct: toPct(safeNum(x?.orderCount, 0), overview.totalOrders),
        revenueSharePct: toPct(safeNum(x?.revenue, 0), overview.totalRevenue),
      }))
    ).slice(0, top);

    const utmMediums: UtmMediumRow[] = sortByCountDesc<UtmMediumRow>(
      (Array.isArray(raw?.utmMediums) ? raw.utmMediums : []).map((x: any) => ({
        utmMedium: labelOrFallback(x?.utmMedium, "unknown"),
        orderCount: safeNum(x?.orderCount, 0),
        revenue: round2(safeNum(x?.revenue, 0)),
        orderSharePct: toPct(safeNum(x?.orderCount, 0), overview.totalOrders),
        revenueSharePct: toPct(safeNum(x?.revenue, 0), overview.totalRevenue),
      }))
    ).slice(0, top);

    const utmCampaigns: UtmCampaignRow[] = sortByCountDesc<UtmCampaignRow>(
      (Array.isArray(raw?.utmCampaigns) ? raw.utmCampaigns : []).map((x: any) => ({
        utmCampaign: labelOrFallback(x?.utmCampaign, "unknown"),
        orderCount: safeNum(x?.orderCount, 0),
        revenue: round2(safeNum(x?.revenue, 0)),
        orderSharePct: toPct(safeNum(x?.orderCount, 0), overview.totalOrders),
        revenueSharePct: toPct(safeNum(x?.revenue, 0), overview.totalRevenue),
      }))
    ).slice(0, top);

    const referrers: ReferrerRow[] = sortByCountDesc<ReferrerRow>(
      (Array.isArray(raw?.referrers) ? raw.referrers : []).map((x: any) => ({
        referrerHost: labelOrFallback(x?.referrerHost, "unknown"),
        orderCount: safeNum(x?.orderCount, 0),
        revenue: round2(safeNum(x?.revenue, 0)),
        orderSharePct: toPct(safeNum(x?.orderCount, 0), overview.totalOrders),
        revenueSharePct: toPct(safeNum(x?.revenue, 0), overview.totalRevenue),
      }))
    ).slice(0, top);

    const dailyMap = new Map<string, DailyTrendRow>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      dailyMap.set(iso, {
        day: iso,
        orderCount: 0,
        revenue: 0,
      });
    }

    const rawDaily = Array.isArray(raw?.dailyTrend) ? raw.dailyTrend : [];
    for (const row of rawDaily) {
      const day = safeStr(row?.day);
      if (!day || !dailyMap.has(day)) continue;
      dailyMap.set(day, {
        day,
        orderCount: safeNum(row?.orderCount, 0),
        revenue: round2(safeNum(row?.revenue, 0)),
      });
    }

    const dailyTrend: DailyTrendRow[] = Array.from(dailyMap.values());

    const recentOrders: RecentOrderRow[] = (Array.isArray(raw?.recentOrders) ? raw.recentOrders : []).map(
      (x: any) => ({
        orderId: safeStr(x?.orderId),
        orderRef: safeStr(x?.orderRef),
        paidAt: x?.paidAt ? new Date(x.paidAt).toISOString() : null,
        totalAmount: round2(safeNum(x?.totalAmount, 0)),
        sourceBucket: normalizeBucketLabel(x?.sourceBucket),
        detectedSource: labelOrFallback(x?.detectedSource, "unknown"),
        utmSource: safeStr(x?.utmSource),
        utmMedium: safeStr(x?.utmMedium),
        utmCampaign: safeStr(x?.utmCampaign),
        referrerHost: safeStr(x?.referrerHost),
        hasAnalytics: Boolean(safeNum(x?.hasAnalytics, 0)),
        itemCount: safeNum(x?.itemCount, 0),
      })
    );

    const topSource: SourceBucketRow | null = sourceBuckets.length > 0 ? sourceBuckets[0] : null;

    const insights = {
      topSourceBucket: topSource ? topSource.sourceBucket : "unknown",
      topSourceOrders: topSource ? topSource.orderCount : 0,
      topSourceRevenue: topSource ? round2(topSource.revenue) : 0,
      attributionCoveragePct: toPct(overview.attributedOrders, overview.totalOrders),
      directOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "direct")?.orderCount,
        0
      ),
      googleOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "google")?.orderCount,
        0
      ),
      youtubeOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "youtube")?.orderCount,
        0
      ),
      instagramOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "instagram")?.orderCount,
        0
      ),
      whatsappOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "whatsapp")?.orderCount,
        0
      ),
      facebookOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "facebook")?.orderCount,
        0
      ),
      referralOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "referral")?.orderCount,
        0
      ),
      otherOrders: safeNum(
        sourceBucketsBase.find((x) => x.sourceBucket === "other")?.orderCount,
        0
      ),
    };

    return NextResponse.json(
      {
        ok: true,
        range: {
          days,
          since: since.toISOString(),
          until: now.toISOString(),
        },
        overview,
        insights,
        sourceBuckets,
        detectedSources,
        utmSources,
        utmMediums,
        utmCampaigns,
        referrers,
        dailyTrend,
        recentOrders,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("ADMIN_ANALYTICS_GET_FAILED:", error);
    return NextResponse.json(
      {
        error: "Failed to load analytics",
        details: safeStr(error?.message || "unknown_error"),
      },
      { status: 500 }
    );
  }
}
