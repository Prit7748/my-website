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

type BlogView = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  metaTitle: string;
  metaDescription: string;
  coverUrl: string;
  coverAlt: string;
  youtubeUrl: string;
  tags: string[];
  categoryId?: string | null;
  authorName: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function safeText(input: unknown) {
  return String(input ?? "").trim();
}

function siteUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://istudentsportal.com";
  return base.replace(/\/+$/, "");
}

async function getSlugFromParams(
  params: Promise<{ slug: string }> | { slug: string }
) {
  const resolved: any =
    typeof (params as any)?.then === "function" ? await (params as any) : params;
  return decodeURIComponent(safeText(resolved?.slug));
}

function stripHtml(html: string) {
  return safeText(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupHtml(raw: string) {
  let html = String(raw || "");
  html = html.replace(/^```html\s*/i, "");
  html = html.replace(/^```\s*/i, "");
  html = html.replace(/```$/i, "");
  return html.trim();
}

function readingTimeFromHtml(html: string) {
  const text = stripHtml(html);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const mins = Math.max(2, Math.ceil(words / 200));
  return { words, mins };
}

function formatDate(date?: string | null) {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

function extractHeadings(html: string) {
  const items: Array<{ level: 2 | 3; text: string; id: string }> = [];
  const re = /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(html))) {
    const level = match[1].toLowerCase() === "h2" ? 2 : 3;
    const text = stripHtml(match[3] || "");
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);

    if (text && id) {
      items.push({ level, text, id });
    }

    if (items.length >= 18) break;
  }

  return items;
}

function injectHeadingIds(html: string) {
  return String(html || "").replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag, attrs, inner) => {
      const hasId = /id\s*=/.test(String(attrs || ""));
      const text = stripHtml(inner || "");
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80);

      if (!text || !id || hasId) return full;
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    }
  );
}

function youtubeId(url: string) {
  const raw = safeText(url);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim();
    }

    const v = parsed.searchParams.get("v");
    if (v) return v.trim();

    const parts = parsed.pathname.split("/").filter(Boolean);
    const embedIndex = parts.indexOf("embed");
    if (embedIndex >= 0 && parts[embedIndex + 1]) {
      return parts[embedIndex + 1].trim();
    }

    return "";
  } catch {
    return "";
  }
}

function isPubliclyVisible(doc: any) {
  if (!doc || !doc.isPublished) return false;
  if (!doc.publishedAt) return true;

  const publishedTime = new Date(doc.publishedAt).getTime();
  if (Number.isNaN(publishedTime)) return false;

  return publishedTime <= Date.now();
}

function mapBlog(doc: any): BlogView {
  return {
    _id: String(doc._id),
    title: safeText(doc.title),
    slug: safeText(doc.slug),
    excerpt: safeText(doc.excerpt),
    contentHtml: cleanupHtml(String(doc.contentHtml || "")),
    metaTitle: safeText(doc.metaTitle),
    metaDescription: safeText(doc.metaDescription),
    coverUrl: safeText(doc.coverUrl),
    coverAlt: safeText(doc.coverAlt),
    youtubeUrl: safeText(doc.youtubeUrl),
    tags: Array.isArray(doc.tags) ? doc.tags.filter(Boolean) : [],
    categoryId: doc.categoryId ? String(doc.categoryId) : null,
    authorName: safeText(doc.authorName) || "IGNOU Students Portal",
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

function resolvedMetaTitle(blog: BlogView) {
  return safeText(blog.metaTitle) || safeText(blog.title);
}

function resolvedMetaDescription(blog: BlogView) {
  return (
    safeText(blog.metaDescription) ||
    safeText(blog.excerpt) ||
    stripHtml(blog.contentHtml).slice(0, 170) ||
    "IGNOU blog post."
  ).slice(0, 170);
}

function resolvedCoverAlt(blog: BlogView) {
  return safeText(blog.coverAlt) || safeText(blog.title) || "Blog cover image";
}

function resolvedOgImage(blog: BlogView) {
  return safeText(blog.coverUrl) || `${siteUrl()}/favicon.ico`;
}

function authorSchema(authorName: string) {
  const name = safeText(authorName) || "IGNOU Students Portal";
  if (name.toLowerCase() === "ignou students portal") {
    return { "@type": "Organization", name };
  }
  return { "@type": "Person", name };
}

async function getBlogBySlug(slug: string) {
  await dbConnect();

  const doc: any = await Blog.findOne({
    slug,
    isPublished: true,
  }).lean();

  if (!doc || !isPubliclyVisible(doc)) {
    return null;
  }

  return mapBlog(doc);
}

async function getRelatedBlogs(primaryTag: string, excludeSlug: string) {
  await dbConnect();

  const query: any = {
    isPublished: true,
    slug: { $ne: excludeSlug },
  };

  if (primaryTag) {
    query.tags = primaryTag;
  }

  const docs: any[] = await Blog.find(query)
    .sort({ publishedAt: -1, createdAt: -1, _id: -1 })
    .limit(6)
    .lean();

  return docs
    .filter((doc) => isPubliclyVisible(doc))
    .map((doc) => {
      const blog = mapBlog(doc);
      return {
        _id: blog._id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        coverUrl: blog.coverUrl,
        coverAlt: blog.coverAlt,
        publishedAt: blog.publishedAt,
      };
    });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = await getSlugFromParams(params);
  const blog = await getBlogBySlug(slug);

  if (!blog) {
    return {
      title: "Blog Not Found",
      robots: { index: false, follow: false },
    };
  }

  const base = siteUrl();
  const canonical = `${base}/blog/${blog.slug}`;
  const metaTitle = resolvedMetaTitle(blog);
  const metaDescription = resolvedMetaDescription(blog);
  const ogImage = resolvedOgImage(blog);

  return {
    title: `${metaTitle} | IGNOU Blog`,
    description: metaDescription,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: canonical,
      title: metaTitle,
      description: metaDescription,
      siteName: "IGNOU Students Portal",
      publishedTime: blog.publishedAt || undefined,
      modifiedTime: blog.updatedAt || blog.publishedAt || undefined,
      authors: [blog.authorName],
      tags: blog.tags,
      images: ogImage
        ? [
            {
              url: ogImage,
              alt: resolvedCoverAlt(blog),
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: ogImage ? [ogImage] : [],
    },
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
  const yid = youtubeId(blog.youtubeUrl);
  const tags = Array.isArray(blog.tags) ? blog.tags.filter(Boolean) : [];
  const primaryTag = tags[0] || "";
  const related = await getRelatedBlogs(primaryTag, blog.slug);

  const publishedISO = blog.publishedAt || new Date().toISOString();
  const modifiedISO = blog.updatedAt || publishedISO;
  const metaTitle = resolvedMetaTitle(blog);
  const metaDescription = resolvedMetaDescription(blog);
  const ogImage = resolvedOgImage(blog);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: metaTitle,
    description: metaDescription,
    mainEntityOfPage: canonical,
    url: canonical,
    image: ogImage ? [ogImage] : undefined,
    author: [authorSchema(blog.authorName)],
    publisher: {
      "@type": "Organization",
      name: "IGNOU Students Portal",
      logo: {
        "@type": "ImageObject",
        url: `${base}/favicon.ico`,
      },
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
      {
        "@type": "ListItem",
        position: 3,
        name: safeText(blog.title),
        item: canonical,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <TopBar />
      <Navbar />

      <style>{`
        .isp-prose :where(h2){scroll-margin-top:120px;}
        .isp-prose :where(h3){scroll-margin-top:120px;}
      `}</style>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(700px 300px at 15% 20%, rgba(59,130,246,0.55), transparent 60%), radial-gradient(900px 420px at 85% 10%, rgba(16,185,129,0.55), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1200px] px-4 py-10 md:py-14">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/80 md:text-sm">
            <Link href="/" className="font-extrabold hover:text-white">
              Home
            </Link>
            <span className="text-white/40">›</span>
            <Link href="/blog" className="font-extrabold hover:text-white">
              Blog
            </Link>
            <span className="text-white/40">›</span>
            <span className="line-clamp-1 font-extrabold text-white/95">
              {safeText(blog.title)}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold">
                  Read time: ~{mins} min
                </span>
                {blog.publishedAt ? (
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold">
                    Published: {formatDate(blog.publishedAt)}
                  </span>
                ) : null}
                {blog.updatedAt ? (
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-extrabold">
                    Updated: {formatDate(blog.updatedAt)}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">
                {safeText(blog.title)}
              </h1>

              {metaDescription ? (
                <p className="mt-4 max-w-[70ch] text-base font-semibold leading-relaxed text-white/85 md:text-lg">
                  {metaDescription}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`https://wa.me/917496865680?text=${encodeURIComponent(
                    `Hi! I read this blog: ${safeText(blog.title)}\n${canonical}\nI need help.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 font-extrabold text-slate-950 transition hover:bg-emerald-600"
                >
                  Get Help on WhatsApp
                </a>

                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-extrabold transition hover:bg-white/15"
                >
                  Browse Study Products
                </Link>
              </div>

              {tags.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {tags.slice(0, 10).map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-extrabold transition hover:bg-white/15"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-5">
              <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur">
                {blog.coverUrl ? (
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5">
                    <Image
                      src={blog.coverUrl}
                      alt={resolvedCoverAlt(blog)}
                      fill
                      className="object-cover"
                      priority
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-white/5 font-extrabold text-white/60">
                    No Cover Image
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${safeText(blog.title)}\n${canonical}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-extrabold transition hover:bg-white/15"
                  >
                    Share WhatsApp
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      safeText(blog.title)
                    )}&url=${encodeURIComponent(canonical)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-extrabold transition hover:bg-white/15"
                  >
                    Share X
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              {yid ? (
                <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                  <div className="relative aspect-video bg-black">
                    <iframe
                      className="absolute inset-0 h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${yid}`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-4">
                    <div className="font-extrabold text-slate-900">Video Included</div>
                    <div className="text-sm font-semibold text-slate-600">
                      Watch here for better understanding.
                    </div>
                  </div>
                </div>
              ) : null}

              <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                <div className="p-5 md:p-8">
                  <div
                    className="isp-prose prose prose-slate prose-headings:font-extrabold prose-a:text-blue-700 max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentHtml }}
                  />
                </div>

                <div className="border-t border-gray-200 bg-gray-50 p-5 md:p-6">
                  <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-green-700 p-6 text-white md:p-8">
                    <div className="text-xl font-extrabold md:text-2xl">
                      Need help for IGNOU Assignments / Notes?
                    </div>
                    <div className="mt-2 font-semibold text-white/90">
                      Get neatly written assignments, PDFs, guides and quick support.
                    </div>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={`https://wa.me/917496865680?text=${encodeURIComponent(
                          `Hi! I read this blog: ${safeText(blog.title)}\n${canonical}\nI need help.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 font-extrabold transition hover:bg-slate-900"
                      >
                        Chat on WhatsApp
                      </a>
                      <Link
                        href="/products"
                        className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-extrabold transition hover:bg-white/15"
                      >
                        Explore Products
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <aside className="lg:col-span-4">
              <div className="space-y-5 lg:sticky lg:top-6">
                {toc.length ? (
                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-extrabold text-slate-900">
                      On this page
                    </div>
                    <div className="mt-3 space-y-2">
                      {toc.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className={`block text-sm font-semibold hover:text-blue-700 ${
                            item.level === 3 ? "pl-4 text-slate-600" : "text-slate-800"
                          }`}
                        >
                          {item.text}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-extrabold text-slate-900">Author</div>
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="font-extrabold text-slate-900">
                      {safeText(blog.authorName) || "IGNOU Students Portal"}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-600">
                      Student-friendly guides, updates, and exam tips.
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`https://wa.me/917496865680?text=${encodeURIComponent(
                          `Hi! I read your blog: ${safeText(blog.title)}. I need help.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700"
                      >
                        WhatsApp
                      </a>
                      <Link
                        href="/blog"
                        className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold transition hover:bg-gray-50"
                      >
                        More Blogs
                      </Link>
                    </div>
                  </div>
                </div>

                {related.length ? (
                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-900">
                        Related Blogs
                      </div>
                      <Link
                        href="/blog"
                        className="text-xs font-extrabold text-blue-700 hover:underline"
                      >
                        View all
                      </Link>
                    </div>

                    <div className="mt-4 space-y-3">
                      {related.map((item) => (
                        <Link
                          key={item.slug}
                          href={`/blog/${item.slug}`}
                          className="block overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md"
                        >
                          {item.coverUrl ? (
                            <div className="relative aspect-[16/9] bg-slate-100">
                              <Image
                                src={item.coverUrl}
                                alt={safeText(item.coverAlt) || safeText(item.title)}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : null}

                          <div className="p-4">
                            <div className="line-clamp-2 font-extrabold text-slate-900">
                              {item.title}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600">
                              {item.excerpt || "Read related guidance and tips."}
                            </div>
                            <div className="mt-2 text-[11px] font-bold text-slate-500">
                              {item.publishedAt ? formatDate(item.publishedAt) : ""}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-extrabold text-slate-900">Quick Tip</div>
                  <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                    Blog me jo bhi checklist aur steps hain, unko copy karke apne notes
                    me rakho. Submission se pehle ek baar re-check karna best hota hai.
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