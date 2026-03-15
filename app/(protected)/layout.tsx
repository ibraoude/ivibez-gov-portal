// app/(protected)/layout.tsx
import { ReactNode } from "react";
import ClientShell from "./ClientShell";
//import "@/lib/security/disable-console";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ClientShell>{children}</ClientShell>;
}