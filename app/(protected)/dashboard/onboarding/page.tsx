"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";

type Organization = {
  id: string;
  name: string;
};

export default function OnboardingPage() {
  return (
    <ProtectedPage>
      <OnboardingPageContent />
    </ProtectedPage>
  );
}

function OnboardingPageContent() {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  async function searchOrganizations(value: string) {
    setSearch(value);

    if (value.length < 2) {
      setOrganizations([]);
      return;
    }

    setSearching(true);

    const { data, error } = await supabase
      .from("organizations")
      .select("id,name")
      .ilike("name", `%${value}%`)
      .limit(5);

    if (error) {
      console.error(error);
      setSearching(false);
      return;
    }

    setOrganizations(data ?? []);
    setSearching(false);
  }

  async function requestJoin() {
    if (!selectedOrg) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.replace(`/login?returnTo=${encodeURIComponent("/onboarding")}`);
      return;
    }

    const { data: existing } = await supabase
      .from("membership_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      alert("You already have a pending membership request.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("membership_requests").insert({
      user_id: user.id,
      org_id: selectedOrg,
      status: "pending",
    });

    if (error) {
      console.error(error);
      alert("Could not send request.");
      setLoading(false);
      return;
    }

    await fetch("/api/membership-request/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: selectedOrg,
        user_id: user.id,
      }),
    });

    alert("Request sent to organization owner.");

    setSelectedOrg(null);
    setSearch("");
    setOrganizations([]);
    setLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto p-10 space-y-6">
      <h1 className="text-2xl font-bold">Join or Create Organization</h1>

      <input
        type="text"
        placeholder="Search organization name..."
        value={search}
        onChange={(e) => searchOrganizations(e.target.value)}
        className="w-full border rounded-lg p-3"
      />

      {searching && <p className="text-sm text-gray-500">Searching...</p>}

      <div className="space-y-2">
        {organizations.map((org) => (
          <div
            key={org.id}
            onClick={() => setSelectedOrg(org.id)}
            className={`border rounded-lg p-3 cursor-pointer ${
              selectedOrg === org.id ? "border-blue-600 bg-blue-50" : ""
            }`}
          >
            {org.name}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={requestJoin}
        disabled={!selectedOrg || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg"
      >
        {loading ? "Sending request..." : "Request to Join"}
      </button>

      <div className="border-t pt-6">
        <p className="text-gray-600 mb-3">Or create a new organization</p>

        <button
          type="button"
          onClick={() =>
            router.replace(
              `/settings/organizations/new?returnTo=${encodeURIComponent("/dashboard")}`
            )
          }
          className="w-full border py-3 rounded-lg"
        >
          Create Organization
        </button>
      </div>
    </div>
  );
}