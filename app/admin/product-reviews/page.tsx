"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";

type ReviewStatus = "pending" | "approved" | "rejected" | "all";

type ReviewItem = {
  _id: string;
  productId: string;
  productSlug: string;
  productTitle: string;

  userId: string;
  userName: string;
  userEmail: string;

  rating: number;
  review: string;

  verifiedPurchase: boolean;
  orderId: string;
  orderRef: string;
  purchasedAt?: string | null;
  purchaseCheckedAt?: string | null;

  status: "pending" | "approved" | "rejected" | string;
  adminNote: string;

  approvedAt?: string | null;
  approvedBy?: string;
  rejectedAt?: string | null;
  rejectedBy?: string;

  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

type ReviewsApiResponse = {
  ok?: boolean;
  error?: string;
  stats?: {
    pending?: number;
    approved?: number;
    rejected?: number;
    deleted?: number;
    totalLive?: number;
  };
  reviews?: ReviewItem[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
};

type MessageState = {
  text: string;
  type: "success" | "error" | "info";
};

function safeStr(input: any) {
  return String(input ?? "").trim();
}

function formatDate(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
}

function clampRating(input: any) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.trunc(n)));
}

function statusBadgeClass(status: string) {
  const s = safeStr(status).toLowerCase();

  if (s === "approved") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  if (s === "rejected") {
    return "bg-rose-50 text-rose-800 border-rose-200";
  }

  return "bg-amber-50 text-amber-800 border-amber-200";
}

function statusIcon(status: string) {
  const s = safeStr(status).toLowerCase();

  if (s === "approved") {
    return <CheckCircle2 size={14} />;
  }

  if (s === "rejected") {
    return <XCircle size={14} />;
  }

  return <Clock3 size={14} />;
}

function StarRating({ rating }: { rating: number }) {
  const r = clampRating(rating);

  return (
    <div className="inline-flex items-center gap-0.5 text-yellow-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={16}
          fill={n <= r ? "currentColor" : "none"}
          className={n <= r ? "text-yellow-500" : "text-slate-300"}
        />
      ))}
    </div>
  );
}

export default function AdminProductReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    deleted: 0,
    totalLive: 0,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [message, setMessage] = useState<MessageState>({
    text: "",
    type: "info",
  });

  const fromItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const toItem = Math.min(page * limit, total);

  const statusTabs = useMemo(
    () => [
      {
        key: "pending" as ReviewStatus,
        label: "Pending",
        count: stats.pending,
      },
      {
        key: "approved" as ReviewStatus,
        label: "Approved",
        count: stats.approved,
      },
      {
        key: "rejected" as ReviewStatus,
        label: "Rejected",
        count: stats.rejected,
      },
      {
        key: "all" as ReviewStatus,
        label: "All Live",
        count: stats.totalLive,
      },
    ],
    [stats]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(t);
  }, [query]);

  async function loadReviews() {
    setLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("status", status);
      qs.set("page", String(page));
      qs.set("limit", String(limit));

      if (debouncedQuery) {
        qs.set("q", debouncedQuery);
      }

      const res = await fetch(`/api/admin/product-reviews?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: ReviewsApiResponse = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setReviews([]);
        setTotal(0);
        setTotalPages(1);
        setMessage({
          text: data?.error || "Reviews load failed.",
          type: "error",
        });
        return;
      }

      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setStats({
        pending: Number(data.stats?.pending || 0),
        approved: Number(data.stats?.approved || 0),
        rejected: Number(data.stats?.rejected || 0),
        deleted: Number(data.stats?.deleted || 0),
        totalLive: Number(data.stats?.totalLive || 0),
      });

      setTotal(Number(data.pagination?.total || 0));
      setTotalPages(Math.max(1, Number(data.pagination?.totalPages || 1)));
    } catch (error: any) {
      setReviews([]);
      setTotal(0);
      setTotalPages(1);
      setMessage({
        text: safeStr(error?.message || "Reviews load failed."),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit, debouncedQuery]);

  useEffect(() => {
    if (!message.text) return;

    const t = setTimeout(() => {
      setMessage({ text: "", type: "info" });
    }, 3500);

    return () => clearTimeout(t);
  }, [message.text]);

  function askAdminNote(title: string, defaultValue = "") {
    const note = window.prompt(title, defaultValue);
    if (note === null) return null;
    return note.trim();
  }

  async function patchReview(
    review: ReviewItem,
    action: "approve" | "reject" | "trash" | "restore"
  ) {
    const labels: Record<typeof action, string> = {
      approve: "approve",
      reject: "reject",
      trash: "move to trash",
      restore: "restore",
    };

    let adminNote = "";

    if (action === "reject") {
      const note = askAdminNote(
        "Reject reason / admin note add karo (optional):",
        review.adminNote || ""
      );
      if (note === null) return;
      adminNote = note;
    }

    if (action === "approve") {
      const note = askAdminNote(
        "Approval note add karna hai? Optional hai. Blank bhi chhod sakte ho:",
        review.adminNote || ""
      );
      if (note === null) return;
      adminNote = note;
    }

    if (action === "trash") {
      const ok = window.confirm(
        `Review ko trash me bhejna hai?\n\nProduct: ${review.productTitle}\nStudent: ${review.userName || review.userEmail}`
      );
      if (!ok) return;
    }

    if (action === "restore") {
      const ok = window.confirm("Review restore karna hai?");
      if (!ok) return;
    }

    setActionLoadingId(review._id);

    try {
      const res = await fetch("/api/admin/product-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reviewId: review._id,
          action,
          adminNote,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setMessage({
          text: data?.error || `Review ${labels} failed.`,
          type: "error",
        });
        return;
      }

      setMessage({
        text: data?.message || `Review ${labels} successfully.`,
        type: "success",
      });

      await loadReviews();
    } catch (error: any) {
      setMessage({
        text: safeStr(error?.message || `Review ${labels} failed.`),
        type: "error",
      });
    } finally {
      setActionLoadingId("");
    }
  }

  async function permanentlyDeleteReview(review: ReviewItem) {
    const ok = window.confirm(
      `Review permanently delete karna hai? Ye recover nahi hoga.\n\nProduct: ${review.productTitle}\nStudent: ${review.userName || review.userEmail}`
    );

    if (!ok) return;

    setActionLoadingId(review._id);

    try {
      const res = await fetch(
        `/api/admin/product-reviews?reviewId=${encodeURIComponent(review._id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setMessage({
          text: data?.error || "Permanent delete failed.",
          type: "error",
        });
        return;
      }

      setMessage({
        text: data?.message || "Review permanently deleted.",
        type: "success",
      });

      await loadReviews();
    } catch (error: any) {
      setMessage({
        text: safeStr(error?.message || "Permanent delete failed."),
        type: "error",
      });
    } finally {
      setActionLoadingId("");
    }
  }

  function changeStatus(nextStatus: ReviewStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-800">
                <ShieldCheck size={14} />
                Verified Buyer Review Moderation
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-slate-900">
                Product Reviews
              </h1>

              <p className="mt-1 text-sm text-slate-600 font-semibold">
                Students ke submitted product reviews ko approve/reject karo.
                Approved reviews public product pages par show honge.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm"
              >
                <ArrowLeft size={18} />
                Back
              </Link>

              <button
                type="button"
                onClick={() => void loadReviews()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 transition font-semibold shadow-sm disabled:opacity-60"
              >
                <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
                Pending
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {stats.pending}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                Approved
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {stats.approved}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-rose-800">
                Rejected
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {stats.rejected}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Live Total
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {stats.totalLive}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Trashed
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {stats.deleted}
              </div>
            </div>
          </div>

          {message.text ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : message.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-gray-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Filter size={18} />
                Filter Reviews
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => {
                  const active = status === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => changeStatus(tab.key)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-extrabold transition ${
                        active
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-gray-50"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-blue-500"
                  placeholder="Search product, student, order, review..."
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap text-sm text-slate-600 font-bold">
            <div>
              Showing {fromItem} - {toItem} of {total} reviews
            </div>
            <div>
              Page {page} of {totalPages}
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-slate-600 font-extrabold">
                <Loader2 className="mx-auto mb-3 animate-spin" size={28} />
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <div className="text-lg font-extrabold text-slate-900">
                  No reviews found
                </div>
                <div className="mt-1 text-sm text-slate-600 font-semibold">
                  Current filter me koi review available nahi hai.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const busy = actionLoadingId === review._id;
                  const isPending = review.status === "pending";
                  const isApproved = review.status === "approved";
                  const isRejected = review.status === "rejected";
                  const productHref = review.productSlug
                    ? `/products/${review.productSlug}`
                    : "";

                  return (
                    <div
                      key={review._id}
                      className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${statusBadgeClass(
                                review.status
                              )}`}
                            >
                              {statusIcon(review.status)}
                              {safeStr(review.status || "pending").toUpperCase()}
                            </span>

                            {review.verifiedPurchase ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">
                                <ShieldCheck size={14} />
                                Verified Purchase
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-800">
                                <XCircle size={14} />
                                Not Verified
                              </span>
                            )}
                          </div>

                          <h2 className="mt-3 text-base md:text-lg font-extrabold text-slate-900 break-words">
                            {review.productTitle || "Untitled Product"}
                          </h2>

                          <div className="mt-1 text-xs text-slate-500 font-semibold break-all">
                            Product ID: {review.productId || "-"}
                          </div>

                          {productHref ? (
                            <Link
                              href={productHref}
                              target="_blank"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline"
                            >
                              Open Product Page <ExternalLink size={13} />
                            </Link>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <StarRating rating={review.rating} />
                          <div className="mt-1 text-xs font-extrabold text-slate-600">
                            {review.rating}/5 Rating
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="text-sm text-slate-800 font-semibold leading-7 whitespace-pre-line">
                          {review.review}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="font-extrabold text-slate-500 uppercase">
                            Student
                          </div>
                          <div className="mt-1 font-extrabold text-slate-900 break-words">
                            {review.userName || "Student"}
                          </div>
                          <div className="mt-1 font-semibold text-slate-600 break-all">
                            {review.userEmail || "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="font-extrabold text-slate-500 uppercase">
                            Purchase
                          </div>
                          <div className="mt-1 font-extrabold text-slate-900">
                            Order: {review.orderRef || "-"}
                          </div>
                          <div className="mt-1 font-semibold text-slate-600">
                            Paid: {formatDate(review.purchasedAt)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="font-extrabold text-slate-500 uppercase">
                            Review Date
                          </div>
                          <div className="mt-1 font-extrabold text-slate-900">
                            Created: {formatDate(review.createdAt)}
                          </div>
                          <div className="mt-1 font-semibold text-slate-600">
                            Updated: {formatDate(review.updatedAt)}
                          </div>
                        </div>
                      </div>

                      {review.adminNote ? (
                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                          <div className="text-xs font-extrabold text-blue-900">
                            Admin Note
                          </div>
                          <div className="mt-1 text-xs font-semibold text-blue-800 whitespace-pre-line">
                            {review.adminNote}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs font-semibold text-slate-500">
                          Approved: {formatDate(review.approvedAt)} • Rejected:{" "}
                          {formatDate(review.rejectedAt)}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {!isApproved ? (
                            <button
                              type="button"
                              onClick={() => void patchReview(review, "approve")}
                              disabled={busy}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white transition disabled:opacity-60"
                            >
                              {busy && isPending ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                              Approve
                            </button>
                          ) : null}

                          {!isRejected ? (
                            <button
                              type="button"
                              onClick={() => void patchReview(review, "reject")}
                              disabled={busy}
                              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-sm font-extrabold text-white transition disabled:opacity-60"
                            >
                              <XCircle size={16} />
                              Reject
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void patchReview(review, "trash")}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-extrabold text-slate-800 transition disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                            Trash
                          </button>

                          <button
                            type="button"
                            onClick={() => void permanentlyDeleteReview(review)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 px-4 py-2 text-sm font-extrabold text-rose-700 transition disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                            Delete Permanently
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={goPrev}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-extrabold text-slate-800 transition disabled:opacity-50"
            >
              Previous
            </button>

            <div className="text-sm font-bold text-slate-600">
              Page {page} / {totalPages}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-extrabold text-slate-800 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>

          {stats.deleted > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Undo2 size={18} className="text-amber-800 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold text-amber-900">
                    Trashed reviews count: {stats.deleted}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-amber-800 leading-6">
                    Current API stats me trashed count available hai. Agar trash
                    listing/restore page bhi chahiye, next step me separate
                    Trash tab add kar sakte hain.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
