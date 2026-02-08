// ✅ FILE PATH: app/handwritten-hardcopy/page.tsx
import { Suspense } from "react";
import HandwrittenHardcopyClient from "./HandwrittenHardcopyClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <HandwrittenHardcopyClient />
    </Suspense>
  );
}
