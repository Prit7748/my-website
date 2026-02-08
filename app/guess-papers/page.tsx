// ✅ FILE PATH: app/guess-papers/page.tsx
import { Suspense } from "react";
import GuessPapersClient from "./GuessPapersClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <GuessPapersClient />
    </Suspense>
  );
}
