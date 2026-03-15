"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import ProtectedPage from "@/components/auth/ProtectedPage";

type MembershipRequest = {
  id: string;
  user_id: string;
  org_id: string;
  requested_at: string;
};

type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

export default function MembershipRequestsPage() {
  return (
    <ProtectedPage>
      <MembershipRequestsPageContent />
    </ProtectedPage>
  );
}

function MembershipRequestsPageContent() {
  const supabase = createClient();

  const [loading, setLoading] = React.useState(true);
  const [requests, setRequests] = React.useState<MembershipRequest[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);

    const { data, error } = await supabase
      .from("membership_requests")
      .select("id, user_id, org_id, requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const reqs = data ?? [];
    setRequests(reqs);

    const userIds = reqs.map((r) => r.user_id);

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,email,first_name,last_name")
        .in("id", userIds);

      const map: Record<string, Profile> = {};

      for (const p of profileData ?? []) {
        map[p.id] = p;
      }

      setProfiles(map);
    }

    setLoading(false);
  }

  async function approve(request: MembershipRequest) {
    setBusyId(request.id);

    const { error } = await supabase
      .from("membership_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setError(error.message);
      setBusyId(null);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        org_id: request.org_id,
        role: "member",
      })
      .eq("id", request.user_id);

    setBusyId(null);
    loadRequests();
  }

  async function reject(request: MembershipRequest) {
    setBusyId(request.id);

    const { error } = await supabase
      .from("membership_requests")
      .update({
        status: "rejected",
        approved_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setError(error.message);
      setBusyId(null);
      return;
    }

    setBusyId(null);
    loadRequests();
  }

  if (loading) {
    return <div className="p-6">Loading membership requests...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Membership Requests</h1>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-gray-500">No pending requests.</div>
      )}

      <div className="space-y-4">
        {requests.map((r) => {
          const p = profiles[r.user_id];

          const name =
            `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Unnamed user";

          return (
            <div
              key={r.id}
              className="flex items-center justify-between border rounded-lg p-4"
            >
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-sm text-gray-600">{p?.email}</div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={busyId === r.id}
                  onClick={() => approve(r)}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Approve
                </button>

                <button
                  disabled={busyId === r.id}
                  onClick={() => reject(r)}
                  className="border px-3 py-1 rounded"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}