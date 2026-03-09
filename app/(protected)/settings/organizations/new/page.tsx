import { Suspense } from "react";
import NewOrganizationClient from "./NewOrganizationClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading organization setup...</div>}>
      <NewOrganizationClient />
    </Suspense>
  );
}