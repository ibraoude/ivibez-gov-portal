import { Suspense } from "react";
import AcceptInviteClient from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading invitation...</div>}>
      <AcceptInviteClient />
    </Suspense>
  );
}