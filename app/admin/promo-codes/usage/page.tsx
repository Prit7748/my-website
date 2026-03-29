import { Suspense } from "react";
import UsageClient from "./UsageClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <UsageClient />
    </Suspense>
  );
}