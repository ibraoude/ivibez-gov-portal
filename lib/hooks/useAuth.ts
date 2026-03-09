"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "manager" | "client" | "auditor";

export interface AppUser {
  id: string;
  email: string;
  role: Role;
  org_id: string | null;
}

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }

      const authUser = sessionData.session.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, org_id")
        .eq("id", authUser.id)
        .single();

      setUser({
        id: authUser.id,
        email: authUser.email!,
        role: (profile?.role ?? "client") as Role,
        org_id: profile?.org_id ?? null,
      });

      setLoading(false);
    }

    loadUser();
  }, [router, pathname, supabase]);

  return { user, loading };
}