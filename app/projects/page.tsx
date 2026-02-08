// ✅ FILE: app/projects/page.tsx
import { Suspense } from "react";
import ProjectsClient from "./ProjectsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ProjectsClient />
    </Suspense>
  );
}
