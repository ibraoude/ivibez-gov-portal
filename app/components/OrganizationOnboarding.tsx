"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProtectedPage from "@/components/auth/ProtectedPage";

type Organization = {
  id: string;
  name: string;
};

export default function OrganizationOnboarding(props: {
  user: { id: string; email?: string | null };
}) {
  return (
    <ProtectedPage>
      <OrganizationOnboardingContent {...props} />
    </ProtectedPage>
  );
}

function OrganizationOnboardingContent({
  user,
}: {
  user: { id: string; email?: string | null };
}) {
  const supabase = createClient();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrgs() {
      setLoadingOrgs(true);
      setError(null);

      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        setError(error.message);
        setOrgs([]);
      } else {
        setOrgs((data ?? []) as Organization[]);
      }

      setLoadingOrgs(false);
    }

    loadOrgs();
  }, []);

  async function requestJoin() {
    if (!selectedOrg) {
      setError("Please select an organization first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase
      .from("membership_requests")
      .insert({
      user_id:user.id,
      org_id:selectedOrg
      });

      if (!error) {

        await fetch("/api/membership-request/notify",{
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body: JSON.stringify({
            org_id:selectedOrg,
            user_id:user.id
          })
        });

      }

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Request sent. The organization owner must approve your membership.");
  }

  async function createOrganization() {
    const name = newOrgName.trim();

    if (!name) {
      setError("Organization name is required.");
      return;
    }

    setCreating(true);
    setError(null);
    setMessage(null);

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name,
        created_by: user.id,
      })
      .select("id, name")
      .single();

    if (orgError || !org) {
      setCreating(false);
      setError(orgError?.message || "Failed to create organization.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        org_id: org.id,
        role: "owner",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setCreating(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-8">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Join or Create an Organization
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-8">
        Your account is active, but it is not attached to an organization yet.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Select an existing organization
        </label>

        <select
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-black/20"
          disabled={loadingOrgs || submitting}
        >
          <option value="">Choose organization</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <button
          onClick={requestJoin}
          disabled={submitting || loadingOrgs}
          className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Sending Request..." : "Request to Join"}
        </button>
      </div>

      <div className="border-t pt-8 border-gray-200 dark:border-white/10">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Or create a new organization
        </label>

        <input
          type="text"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          placeholder="Organization name"
          className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-black/20"
          disabled={creating}
        />

        <button
          onClick={createOrganization}
          disabled={creating}
          className="mt-3 w-full rounded-lg border px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60"
        >
          {creating ? "Creating Organization..." : "Create Organization"}
        </button>
      </div>
    </div>
  );
}