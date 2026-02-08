// ✅ FILE: app/question-papers/page.tsx
import { Suspense } from "react";
import QuestionPapersClient from "./QuestionPapersClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <QuestionPapersClient />
    </Suspense>
  );
}
