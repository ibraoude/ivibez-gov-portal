import { Suspense } from "react";
import SignupClient from "./SignupClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading signup...</div>}>
      <SignupClient />
    </Suspense>
  );
}