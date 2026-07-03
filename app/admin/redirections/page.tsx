import { Suspense } from "react";
import RedirectionClient from "./RedirectionClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <RedirectionClient />
    </Suspense>
  );
}
