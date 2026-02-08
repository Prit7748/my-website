// ✅ FILE PATH: app/handwritten-pdfs/page.tsx
import { Suspense } from "react";
import HandwrittenPdfsClient from "./HandwrittenPdfsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <HandwrittenPdfsClient />
    </Suspense>
  );
}
