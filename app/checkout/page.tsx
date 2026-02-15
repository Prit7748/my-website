import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 font-bold text-slate-700">Loading checkout...</div>}>
      <CheckoutClient />
    </Suspense>
  );
}
