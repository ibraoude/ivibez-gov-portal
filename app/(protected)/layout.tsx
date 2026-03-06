'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

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
  ]

  /* ===============================
     AUTH + ORG GUARD
  ================================ */
  useEffect(() => {
    let mounted = true

    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.replace("/login")
        return
      }

      const userId = sessionData.session.user.id

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", userId)
        .maybeSingle()

      if (error || !profile) {
        router.replace("/login")
        return
      }

      // 🚨 Force org creation if missing
      if (!profile.org_id) {
        if (!pathname.startsWith("/settings/organizations")) {
          router.replace("/settings/organizations/new")
          return
        }
      }

      if (mounted) {
        setAuthenticated(true)
        setLoading(false)
      }
    }

    checkAccess()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login")
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, []) // ✅ run once only

  /* ===============================
     LOGOUT
  ================================ */
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  /* ===============================
     LOADING
  ================================ */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Checking access...</div>
      </div>
    )
  }

  if (!authenticated) return null

  /* ===============================
     LAYOUT
  ================================ */
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

          <nav className="p-4 space-y-2">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + "/")

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block px-3 py-2 rounded-lg text-sm transition",
                    active
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "hover:bg-gray-50 text-gray-700",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              )
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

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}