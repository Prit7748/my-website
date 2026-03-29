// app/solved-assignments/page.tsx
import SolvedAssignmentsClient from "./SolvedAssignmentsClient";

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    course?: string;
    session?: string;
    search?: string;
    page?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const sp = (await searchParams) || {};

  return (
    <SolvedAssignmentsClient
      initialCategoryParam={typeof sp.category === "string" ? sp.category : ""}
      initialCourseParam={typeof sp.course === "string" ? sp.course : ""}
      initialSessionParam={typeof sp.session === "string" ? sp.session : ""}
      initialSearchParam={typeof sp.search === "string" ? sp.search : ""}
      initialPageParam={typeof sp.page === "string" ? sp.page : "1"}
    />
  );
}