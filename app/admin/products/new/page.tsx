import { Suspense } from "react";
import NewProductClient from "./NewProductClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-700 font-bold">Loading...</div>}>
      <NewProductClient />
    </Suspense>
  );
}
