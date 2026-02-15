// app/blog/[slug]/page.tsx (INDUSTRIAL UI + TopBar/Navbar/Footer + Next16 params Promise fix)

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

import TopBar from "@/components/TopBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeText(input: any) {
  return String(input || "").trim();
}

async function getSlugFromParams(params: Promise<{ slug: string }> | { slug: string }) {
  const p: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
  return decodeURIComponent(safeText(p?.slug));
}

function stripHtml(html: string) {
  return safeText(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Admin panel se ```html ... ``` aata hai to clean
function cleanupHtml(raw: string) {
  let s = String(raw || "");
  s = s.replace(/^```html\s*/i, "");
  s = s.replace(/^```\s*/i, "");
  s = s.replace(/```$/i, "");
  return s.trim();
}

function readingTimeFromHtml(html: string) {
  const text = stripHtml(html || "");
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const mins = Math.max(2, Math.ceil(words / 200));
  return { words, mins };
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(d));
  } catch {
    return String(d);
  }
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

function siteUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

async function getBlogBySlug(slug: string) {
  await dbConnect();
  const b: any = await Blog.findOne({ slug, isPublished: true }).lean();
  if (!b) return null;

  return {
    _id: String(b._id),
    title: safeText(b.title),
    slug: safeText(b.slug),
    excerpt: safeText(b.excerpt),
    contentHtml: cleanupHtml(String(b.contentHtml || "")),
    coverUrl: safeText(b.coverUrl),
    youtubeUrl: safeText(b.youtubeUrl),
    tags: Array.isArray(b.tags) ? b.tags.filter(Boolean) : [],
    authorName: safeText(b.authorName) || "IGNOU Students Portal",
    publishedAt: b.publishedAt ? new Date(b.publishedAt).toISOString() : null,
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
    updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : null,
  };
}

async function getRelated(primaryTag: string, excludeSlug: string) {
  await dbConnect();
  const q: any = { isPublished: true };
  if (primaryTag) q.tags = primaryTag;
  if (excludeSlug) q.slug = { $ne: excludeSlug };

  const rows: any[] = await Blog.find(q).sort({ publishedAt: -1, createdAt: -1 }).limit(6).lean();

  return (rows || []).map((r: any) => ({
    _id: String(r._id),
    title: safeText(r.title),
    slug: safeText(r.slug),
    excerpt: safeText(r.excerpt),
    coverUrl: safeText(r.coverUrl),
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = await getSlugFromParams(params);
  const blog = await getBlogBySlug(slug);
  if (!blog) return { title: "Blog Not Found", robots: { index: false, follow: false } };

  const base = siteUrl();
  const canonical = `${base}/blog/${blog.slug}`;

  const title = safeText(blog.title);
  const description = (
    safeText(blog.excerpt) || stripHtml(safeText(blog.contentHtml)).slice(0, 180) || "IGNOU blog post."
  ).slice(0, 180);

  const ogImage = safeText(blog.coverUrl) || `${base}/favicon.ico`;

  return {
    title: `${title} | IGNOU Blog`,
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

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = await getSlugFromParams(params);

  const blog = await getBlogBySlug(slug);
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

  const related = await getRelated(primaryTag, blog.slug);

  const publishedISO = blog.publishedAt || new Date().toISOString();
  const modifiedISO = blog.updatedAt || publishedISO;

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
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <TopBar />
      <Navbar />

      <style>{`
        .isp-prose :where(h2){scroll-margin-top:120px;}
        .isp-prose :where(h3){scroll-margin-top:120px;}
      `}</style>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage:
            "radial-gradient(700px 300px at 15% 20%, rgba(59,130,246,0.55), transparent 60%), radial-gradient(900px 420px at 85% 10%, rgba(16,185,129,0.55), transparent 60%)"
        }} />
        <div className="relative max-w-[1200px] mx-auto px-4 py-10 md:py-14">
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-semibold text-white/80">
            <Link href="/" className="hover:text-white font-extrabold">Home</Link>
            <span className="text-white/40">›</span>
            <Link href="/blog" className="hover:text-white font-extrabold">Blog</Link>
            <span className="text-white/40">›</span>
            <span className="text-white/95 font-extrabold line-clamp-1">{safeText(blog.title)}</span>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold">
                  Read time: ~{mins} min
                </span>
                {blog.publishedAt ? (
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold">
                    Published: {fmtDate(blog.publishedAt)}
                  </span>
                ) : null}
                {blog.updatedAt ? (
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold">
                    Updated: {fmtDate(blog.updatedAt)}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-3xl md:text-5xl font-extrabold leading-tight">
                {safeText(blog.title)}
              </h1>

              {safeText(blog.excerpt) ? (
                <p className="mt-4 text-base md:text-lg text-white/85 font-semibold leading-relaxed max-w-[70ch]">
                  {safeText(blog.excerpt)}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href={`https://wa.me/917496865680?text=${encodeURIComponent(
                    `Hi! I read this blog: ${safeText(blog.title)}\n${canonical}\nI need help.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-6 py-3 font-extrabold transition"
                >
                  Get Help on WhatsApp
                </a>

                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-6 py-3 font-extrabold transition"
                >
                  Browse Study Products
                </Link>
              </div>

              {tags.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {tags.slice(0, 10).map((t) => (
                    <Link
                      key={t}
                      href={`/blog?tag=${encodeURIComponent(t)}`}
                      className="rounded-full border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-1 text-[12px] font-extrabold transition"
                    >
                      #{t}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-2 h-full">
                {safeText(blog.coverUrl) ? (
                  <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-white/5">
                    <Image
                      src={safeText(blog.coverUrl)}
                      alt={safeText(blog.title)}
                      fill
                      className="object-cover"
                      priority
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] rounded-2xl bg-white/5 flex items-center justify-center text-white/60 font-extrabold">
                    No Cover Image
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${safeText(blog.title)}\n${canonical}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/15 bg-white/10 hover:bg-white/15 px-4 py-3 text-sm font-extrabold text-center transition"
                  >
                    Share WhatsApp
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(safeText(blog.title))}&url=${encodeURIComponent(canonical)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/15 bg-white/10 hover:bg-white/15 px-4 py-3 text-sm font-extrabold text-center transition"
                  >
                    Share X
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="py-10 md:py-14">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* MAIN */}
            <div className="lg:col-span-8">
              {/* Optional video */}
              {yid ? (
                <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm mb-6">
                  <div className="relative aspect-video bg-black">
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube-nocookie.com/embed/${yid}`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-4">
                    <div className="font-extrabold text-slate-900">Video Included</div>
                    <div className="text-sm text-slate-600 font-semibold">
                      Watch here for better understanding.
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Article */}
              <article className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 md:p-8">
                  <div
                    className="isp-prose prose prose-slate prose-headings:font-extrabold prose-a:text-blue-700 max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentHtml }}
                  />
                </div>

                {/* CTA strip */}
                <div className="border-t border-gray-200 bg-gray-50 p-5 md:p-6">
                  <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-green-700 text-white p-6 md:p-8">
                    <div className="text-xl md:text-2xl font-extrabold">Need help for IGNOU Assignments / Notes?</div>
                    <div className="mt-2 text-white/90 font-semibold">
                      Get neatly written assignments, PDFs, guides and quick support.
                    </div>
                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <a
                        href={`https://wa.me/917496865680?text=${encodeURIComponent(
                          `Hi! I read this blog: ${safeText(blog.title)}\n${canonical}\nI need help.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 hover:bg-slate-900 px-6 py-3 font-extrabold transition"
                      >
                        Chat on WhatsApp
                      </a>
                      <Link
                        href="/products"
                        className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-6 py-3 font-extrabold transition"
                      >
                        Explore Products
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            {/* SIDEBAR */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-6 space-y-5">
                {/* TOC */}
                {toc.length ? (
                  <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5">
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

                {/* AUTHOR CARD */}
                <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="text-sm font-extrabold text-slate-900">Author</div>
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="font-extrabold text-slate-900">{safeText(blog.authorName) || "IGNOU Students Portal"}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-1">
                      Student-friendly guides, updates, and exam tips.
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`https://wa.me/917496865680?text=${encodeURIComponent(
                          `Hi! I read your blog: ${safeText(blog.title)}. I need help.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-extrabold transition"
                      >
                        WhatsApp
                      </a>
                      <Link
                        href="/blog"
                        className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-extrabold transition"
                      >
                        More Blogs
                      </Link>
                    </div>
                  </div>
                </div>

                {/* RELATED */}
                {related.length ? (
                  <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900">Related Blogs</div>
                      <Link href="/blog" className="text-xs font-extrabold text-blue-700 hover:underline">
                        View all
                      </Link>
                    </div>
                    <div className="mt-4 space-y-3">
                      {related.map((r) => (
                        <Link
                          key={r.slug}
                          href={`/blog/${r.slug}`}
                          className="block rounded-2xl border border-gray-200 bg-white hover:shadow-md transition overflow-hidden"
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
                            <div className="mt-2 text-[11px] font-bold text-slate-500">
                              {r.publishedAt ? fmtDate(r.publishedAt) : ""}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* MINI TRUST BOX */}
                <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="text-sm font-extrabold text-slate-900">Quick Tip</div>
                  <div className="mt-2 text-sm text-slate-600 font-semibold leading-relaxed">
                    Blog me jo bhi checklist / steps hain, unko copy karke apne notes me rakho. Submission se pehle 1 baar re-check karna best hota hai.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
