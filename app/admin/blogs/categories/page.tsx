// ✅ FILE: app/admin/blogs/categories/page.tsx
import { Suspense } from "react";
import CategoryClient from "./CategoryClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CategoryClient />
    </Suspense>
  );
}
