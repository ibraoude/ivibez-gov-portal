// app/(protected)/layout.tsx

import type { ReactNode } from "react";
import ClientShell from "./ClientShell";

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ClientShell>{children}</ClientShell>;
}