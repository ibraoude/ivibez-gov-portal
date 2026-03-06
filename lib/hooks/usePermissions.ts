'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Permissions = {
  isSuperAdmin: boolean;
  orgRole: string | null;
  orgId: string | null;
  canManageMembers: boolean;
  canInvite: boolean;
  canRemoveMembers: boolean;
};

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/me/permissions", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load permissions");
          setLoading(false);
          return;
        }

        setPermissions(data);
        setLoading(false);

      } catch (err: any) {
        setError(err?.message || "Unexpected error");
        setLoading(false);
      }
    };

    loadPermissions();
  }, []);

  return { permissions, loading, error };
}