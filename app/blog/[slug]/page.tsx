// app/blog/[slug]/page.tsx (Complete Replace)
// ✅ Only additions for output:"export": generateStaticParams + dynamicParams
// ✅ Also: Next/Image must be unoptimized for static export (no server image optimizer)

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type ApiBlog = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  coverUrl?: string;
  youtubeUrl?: string;
  tags?: string[];
  authorName?: string;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type RelatedBlog = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverUrl?: string;
  tags?: string[];
  publishedAt?: string | null;
};

function siteUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}
function safeText(input: any) {
  return String(input || "").trim();
}
function stripHtml(html: string) {
  return safeText(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function readingTimeFromHtml(html: string) {
  const text = stripHtml(html || "");
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const mins = Math.max(1, Math.ceil(words / 200));
  return { words, mins };
}
function extractHeadings(html: string) {
  const src = String(html || "");
  const re = /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi;
  const items: Array<{ level: 2 | 3; text: string; id: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const level = m[1].toLowerCase() === "h2" ? 2 : 3;
    const inner = stripHtml(m[3] || "");
    const id = inner
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
    if (inner && id) items.push({ level, text: inner, id });
    if (items.length >= 18) break;
  }
  return items;
}
function injectHeadingIds(html: string) {
  const src = String(html || "");
  return src.replace(/<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    const hasId = /id\s*=/.test(String(attrs || ""));
    const text = stripHtml(inner || "");
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
    if (!text || !id) return full;
    if (hasId) return full;
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
  });
}
function youtubeId(url: string) {
  const u = safeText(url);
  if (!u) return "";
  try {
    const parsed = new URL(u);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "").trim();
    const v = parsed.searchParams.get("v");
    if (v) return v.trim();
    const parts = parsed.pathname.split("/").filter(Boolean);
    const embedIndex = parts.indexOf("embed");
    if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1].trim();
    return "";
  } catch {
    return "";
  }
}

async function fetchBlog(slug: string) {
  const url = `${siteUrl()}/api/blogs/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return { blog: (data?.blog || null) as ApiBlog | null, status: res.status };
}

async function fetchRelated(tag: string, exclude: string) {
  const q = new URLSearchParams();
  q.set("limit", "6");
  if (tag) q.set("tag", tag);
  if (exclude) q.set("exclude", exclude);
  const url = `${siteUrl()}/api/blogs?${q.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return (Array.isArray(data?.blogs) ? data.blogs : []) as RelatedBlog[];
}

/**
 * ✅ REQUIRED for output:"export"
 * Dynamic blog route needs build-time params.
 * For now keep empty so build passes (safe). Add real slugs later.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(safeText(params?.slug));
  const { blog } = await fetchBlog(slug);
  if (!blog) return { title: "Blog Not Found", robots: { index: false, follow: false } };

  const base = siteUrl();
  const canonical = `${base}/blog/${blog.slug}`;

  const title = safeText(blog.title);
  const description =
    (safeText(blog.excerpt) ||
      stripHtml(safeText(blog.contentHtml)).slice(0, 180) ||
      "IGNOU blog post.").slice(0, 180);

  const ogImage = safeText(blog.coverUrl) || `${base}/images/cover1.jpg`;

  return {
    title: `${title} | Blog`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "IGNOU Students Portal",
      images: ogImage ? [{ url: ogImage, alt: title }] : [],
    },
    twitter: { card: "summary_large_image", title, description, images: ogImage ? [ogImage] : [] },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(safeText(params?.slug));
  const { blog } = await fetchBlog(slug);
  if (!blog) notFound();

  const base = siteUrl();
  const canonical = `${base}/blog/${blog.slug}`;

  const contentHtmlRaw = safeText(blog.contentHtml);
  const contentHtml = injectHeadingIds(contentHtmlRaw);
  const toc = extractHeadings(contentHtmlRaw);

  const { mins } = readingTimeFromHtml(contentHtmlRaw);

  const yid = youtubeId(safeText(blog.youtubeUrl));
  const tags = Array.isArray(blog.tags) ? blog.tags.filter(Boolean) : [];
  const primaryTag = tags[0] || "";

  const related = await fetchRelated(primaryTag, blog.slug);

  const publishedISO = blog.publishedAt ? new Date(blog.publishedAt).toISOString() : new Date().toISOString();
  const modifiedISO = blog.updatedAt ? new Date(blog.updatedAt).toISOString() : publishedISO;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: safeText(blog.title),
    description: safeText(blog.excerpt) || stripHtml(contentHtmlRaw).slice(0, 180),
    mainEntityOfPage: canonical,
    url: canonical,
    image: safeText(blog.coverUrl) ? [safeText(blog.coverUrl)] : undefined,
    author: [{ "@type": "Person", name: safeText(blog.authorName) || "IGNOU Students Portal" }],
    publisher: {
      "@type": "Organization",
      name: "IGNOU Students Portal",
      logo: { "@type": "ImageObject", url: `${base}/favicon.ico` },
    },
    datePublished: publishedISO,
    dateModified: modifiedISO,
    keywords: tags.join(", "),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/blog` },
      { "@type": "ListItem", position: 3, name: safeText(blog.title), item: canonical },
    ],
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(37,99,235,0.08),transparent),radial-gradient(900px_500px_at_90%_10%,rgba(16,185,129,0.08),transparent)] text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="max-w-[1200px] mx-auto px-4 pt-8 pb-16">
        <div className="text-xs md:text-sm text-slate-600 font-semibold flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-blue-700 font-extrabold">Home</Link>
          <span className="text-slate-300">›</span>
          <Link href="/blog" className="hover:text-blue-700 font-extrabold">Blog</Link>
          <span className="text-slate-300">›</span>
          <span className="text-slate-900 font-extrabold">{safeText(blog.title)}</span>
        </div>

        <article className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm overflow-hidden">
              {safeText(blog.coverUrl) ? (
                <div className="relative aspect-[16/9] bg-slate-100">
                  <Image
                    src={safeText(blog.coverUrl)}
                    alt={safeText(blog.title)}
                    fill
                    className="object-cover"
                    priority
                    unoptimized
                  />
                </div>
              ) : null}

              <div className="p-5 md:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
                    Read time: ~{mins} min
                  </span>
                  {tags.slice(0, 4).map((t) => (
                    <Link
                      key={t}
                      href={`/blog?tag=${encodeURIComponent(t)}`}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-extrabold text-slate-700 hover:text-blue-700"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                  {safeText(blog.title)}
                </h1>

                {safeText(blog.excerpt) ? (
                  <p className="mt-3 text-base md:text-lg font-semibold text-slate-600 leading-relaxed">
                    {safeText(blog.excerpt)}
                  </p>
                ) : null}

                {yid ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-black overflow-hidden">
                    <div className="relative aspect-video">
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube-nocookie.com/embed/${yid}`}
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-3 bg-white">
                      <div className="text-xs font-extrabold text-slate-900">Video included</div>
                      <div className="text-[12px] font-semibold text-slate-600">
                        Watch on this page (better engagement + SEO).
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  className="mt-7 prose prose-slate prose-headings:font-extrabold prose-a:text-blue-700 max-w-none"
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />

                <div className="mt-10 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/products"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-5 py-3 font-extrabold hover:bg-slate-800"
                  >
                    Browse Products
                  </Link>
                  <a
                    href={`https://wa.me/917496865680?text=${encodeURIComponent(
                      `Hi! I read this blog: ${safeText(blog.title)}\n${canonical}\nI need help.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-5 py-3 font-extrabold hover:bg-emerald-100"
                  >
                    Ask on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-6 space-y-5">
              {toc.length > 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm p-5">
                  <div className="text-sm font-extrabold text-slate-900">On this page</div>
                  <div className="mt-3 space-y-2">
                    {toc.map((x) => (
                      <a
                        key={x.id}
                        href={`#${x.id}`}
                        className={`block text-sm font-semibold hover:text-blue-700 ${
                          x.level === 3 ? "pl-4 text-slate-600" : "text-slate-800"
                        }`}
                      >
                        {x.text}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm p-5">
                <div className="text-sm font-extrabold text-slate-900">Share</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${safeText(blog.title)}\n${canonical}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50 text-center"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(safeText(blog.title))}&url=${encodeURIComponent(canonical)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50 text-center"
                  >
                    X / Twitter
                  </a>
                </div>
              </div>

              {related.length > 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-extrabold text-slate-900">Related Blogs</div>
                    <Link href="/blog" className="text-xs font-extrabold text-blue-700 hover:underline">View all</Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {related.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/blog/${r.slug}`}
                        className="block rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition overflow-hidden"
                      >
                        {r.coverUrl ? (
                          <div className="relative aspect-[16/9] bg-slate-100">
                            <Image src={r.coverUrl} alt={r.title} fill className="object-cover" unoptimized />
                          </div>
                        ) : null}
                        <div className="p-4">
                          <div className="font-extrabold text-slate-900 line-clamp-2">{r.title}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-600 line-clamp-2">
                            {r.excerpt || "Read related guidance and tips."}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </article>
      </div>
    </main>
  );
}
