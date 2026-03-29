// app/combo/[category]/page.tsx
import { notFound } from "next/navigation";
import ComboCategoryClient from "./ComboCategoryClient";

const ALLOWED_CATEGORY_SLUGS = new Set([
  "solved-assignments",
  "question-papers",
  "guess-papers",
  "ebooks-notes",
  "handwritten-pdfs",
  "handwritten-hardcopy",
  "projects-synopsis",
]);

type PageProps = {
  params: Promise<{
    category: string;
  }>;
  searchParams?: Promise<{
    search?: string;
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const p = await params;
  const sp = (await searchParams) || {};

  const category = typeof p?.category === "string" ? p.category : "";

  if (!ALLOWED_CATEGORY_SLUGS.has(category)) {
    notFound();
  }

  return (
    <ComboCategoryClient
      categorySlug={category}
      initialSearchParam={typeof sp?.search === "string" ? sp.search : ""}
    />
  );
}