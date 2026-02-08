// ✅ FILE PATH: app/ebooks/page.tsx
import { Suspense } from "react";
import EbooksClient from "./EbooksClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <EbooksClient />
    </Suspense>
  );
}
