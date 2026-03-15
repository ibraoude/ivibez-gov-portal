"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Vendor = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export default function AssignVendor({
  contractId,
  mode = "assign",
}: {
  contractId: string;
  mode?: "assign" | "change";
}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name")
      .eq("role", "vendor")
      .order("first_name");

    if (!error) {
      setVendors((data ?? []) as Vendor[]);
    }

    setLoading(false);
  }

  async function assignVendor() {
    if (!selected) {
      alert("Please select a vendor first.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("contracts")
      .update({ vendor_id: selected })
      .eq("id", contractId);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(mode === "change" ? "Vendor updated successfully" : "Vendor assigned successfully");

    // refresh page so vendor card updates
    window.location.reload();
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">
        {mode === "change" ? "Change Vendor" : "Assign Vendor"}
      </h3>

      {loading ? (
        <div className="text-sm text-gray-500">Loading vendors...</div>
      ) : (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border rounded p-2 w-full dark:bg-black"
        >
          <option value="">Select vendor</option>

          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.first_name ?? ""} {v.last_name ?? ""} ({v.email})
            </option>
          ))}
        </select>
      )}

      <button
        onClick={assignVendor}
        disabled={saving || !selected}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving
          ? "Saving..."
          : mode === "change"
          ? "Update Vendor"
          : "Assign Vendor"}
      </button>
    </div>
  );
}