// app/products/page.tsx
import ProductsClient from "./ProductsClient";

type PageProps = {
  searchParams?: Promise<{
    search?: string;
    category?: string;
    course?: string;
    session?: string;
    language?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const sp = (await searchParams) || {};

  return (
    <ProductsClient
      initialSearchParam={typeof sp.search === "string" ? sp.search : ""}
      initialCategoryParam={typeof sp.category === "string" ? sp.category : ""}
      initialCourseParam={typeof sp.course === "string" ? sp.course : ""}
      initialSessionParam={typeof sp.session === "string" ? sp.session : ""}
      initialLanguageParam={typeof sp.language === "string" ? sp.language : ""}
      initialSortParam={typeof sp.sort === "string" ? sp.sort : "latest"}
      initialPageParam={typeof sp.page === "string" ? sp.page : "1"}
    />
  );
}