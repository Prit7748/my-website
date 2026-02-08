// ✅ FILE: app/solved-assignments/page.tsx
import { Suspense } from "react";
import SolvedAssignmentsClient from "./SolvedAssignmentsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SolvedAssignmentsClient />
    </Suspense>
  );
}
