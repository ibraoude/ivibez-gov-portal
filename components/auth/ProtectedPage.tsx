
// components/auth/ProtectedPage.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPermissions, Role } from "@/lib/permissions/roles";

export type PermissionKey =
  | "manageMembers"
  | "inviteUsers"
  | "approveRequests"
  | "manageOrganization"
  | "viewReports"
  | "readOnly"
  | "viewDashboard"
  | "viewContracts"
  | "submitCompletion"
  | "uploadDocuments"
  | "viewPayments";

type Props = {
  /** If omitted, any authenticated user is allowed. */
  permission?: PermissionKey;
  children: ReactNode;
  /** Optional: custom unauthorized UI */
  unauthorizedFallback?: ReactNode;
  /** Optional: show a different loading UI */
  loadingFallback?: ReactNode;
};

export default function ProtectedPage({
  permission,
  children,
  unauthorizedFallback,
  loadingFallback,
}: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPermissions() {
      try {
        // 1) Auth
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
          if (!cancelled) {
            setAllowed(false);
            setLoading(false);
          }
          return;
        }

        // 2) Load profile role & global admin flag in parallel
       const [profileRes, adminRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, org_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const role = (profileRes.data?.role ?? null) as Role | null;
      const orgId = profileRes.data?.org_id ?? null;
      const isGlobalAdmin = !!adminRes.data;

      let isAllowed = false;

      if (isGlobalAdmin) {
        isAllowed = true;
      } else if (!orgId) {
        isAllowed = true;
      } else if (!permission) {
        isAllowed = true;
      } else {
        const perms = getPermissions(role);
        isAllowed = Boolean(perms?.[permission]);
      }

        if (!cancelled) {
          setAllowed(isAllowed);
          setLoading(false);
        }
      } catch (e) {
        console.warn("ProtectedPage permission check failed:", e);
        if (!cancelled) {
          setAllowed(false);
          setLoading(false);
        }
      }
    }

    checkPermissions();
    return () => {
      cancelled = true;
    };
  }, [permission, supabase]);

  if (loading) {
    return (
      loadingFallback ?? (
        <div className="flex h-screen items-center justify-center text-gray-500">
          Checking access…
        </div>
      )
    );
  }

  if (!allowed) {
    return (
      unauthorizedFallback ?? (
        <div className="flex h-screen items-center justify-center text-gray-500">
          You do not have permission to access this page.
        </div>
      )
    );
  }

  return <>{children}</>;
}
