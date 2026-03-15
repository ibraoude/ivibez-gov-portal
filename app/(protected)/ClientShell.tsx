"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

import { getSidebarLinks, Role } from "@/lib/permissions/roles";

const supabase = createClient();

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [role, setRole] = useState<Role | null>(null);
  const [nav, setNav] = useState<{ label: string; href: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const r = profile?.role as Role | null;

      setRole(r);
      setNav(getSidebarLinks(r));
      setLoading(false);
    }

    loadRole();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}

    document.location = "/login";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

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
                pathname === item.href ||
                pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
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
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}