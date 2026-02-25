'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  BarChart3,
  Settings
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Contracts", href: "/dashboard/contracts", icon: FileText },
    { name: "Service Requests", href: "/dashboard/requests", icon: ClipboardList },
    { name: "Reports & Analytics", href: "/dashboard/reports", icon: BarChart3 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">

      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r p-6 space-y-6">

        <div>
          <h2 className="text-xl font-semibold">Client Portal</h2>
          <p className="text-xs text-gray-500">GovCon Dashboard</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8">
        {children}
      </main>

    </div>
  );
}