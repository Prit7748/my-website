// ✅ FILE: app/blog/page.tsx
import { Suspense } from "react";
import BlogClient from "./BlogClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BlogClient />
    </Suspense>
  );
}
