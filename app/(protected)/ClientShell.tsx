
// app/(protected)/ClientShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function ClientShell({ children }: { children: React.ReactNode }) {
  // Hooks are called unconditionally at the top level (no conditionals/early returns).
  const pathname = usePathname();

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/awards", label: "Awards" },
    { href: "/contracts", label: "Contracts" },
    { href: "/requests", label: "Requests" },
    { href: "/dashboard/members", label: "Members" },
    { href: "/invitations", label: "Invitations" },
    { href: "/reports", label: "Reports" },
    { href: "/settings/users", label: "Users" },
    { href: "/settings/organizations", label: "Organizations" },
    { href: "/dashboard/analytics", label: "Analytics" },
  ];

  // Hard-redirect after signing out so no previously mounted protected components re-render
  // in the same client render cycle (prevents hook order mismatches).
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}

    document.location = "/login";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col justify-between">
        <div>
          <div className="p-6 border-b">
            <div className="text-xl font-bold">
              iVibeZ <span className="text-blue-700">Solutions</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Gov Portal</p>
          </div>

          <nav className="p-4 space-y-2" aria-label="Primary">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false} // avoid background proxy runs on protected links
                  className={[
                    "block px-3 py-2 rounded-lg text-sm transition",
                    active
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "hover:bg-gray-50 text-gray-700",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full border border-red-300 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50 transition"
            aria-label="Sign out"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
``
