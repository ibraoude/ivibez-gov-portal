"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import ProtectedPage from "@/components/auth/ProtectedPage";



type VendorContract = {
  id: string;
  contract_number: string | null;
  title: string | null;
  contract_description: string | null;
  final_amount: number | null;
  status: string | null;
  completion_status: string | null;
  payment_status: string | null;
  created_at: string | null;
  vendor_id: string | null;
};

function badgeClass(status?: string | null) {
  const s = (status || "").toLowerCase();

  if (s === "approved" || s === "paid") return "bg-green-100 text-green-800";
  if (s === "submitted" || s === "pending" || s === "under_review") return "bg-yellow-100 text-yellow-800";
  if (s === "needs_revision" || s === "failed") return "bg-red-100 text-red-800";
  if (s === "processing" || s === "active") return "bg-blue-100 text-blue-800";

  return "bg-gray-100 text-gray-700";
}

function money(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function Page() {
  return (
    <ProtectedPage permission="viewContracts">
      <VendorContractsPage />
    </ProtectedPage>
  );
}
function VendorContractsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("contracts")
      .select(
        "id, contract_number, title, contract_description, final_amount, status, completion_status, payment_status, created_at, vendor_id"
      )
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setContracts([]);
      setLoading(false);
      return;
    }

    setContracts((data ?? []) as VendorContract[]);
    setLoading(false);
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Contracts</h1>
          <p className="text-sm text-gray-600">
            View assigned contracts, submit completion, and track payment.
          </p>
        </div>

        <button
          onClick={loadContracts}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No assigned contracts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Contract Status</th>
                <th className="px-4 py-3">Completion</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <Link
                      href={`/vendor/contracts/${c.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {c.contract_number || "—"}
                    </Link>
                    <div className="text-gray-500">{c.title || "Untitled contract"}</div>
                  </td>
                  <td className="px-4 py-3">{money(c.final_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${badgeClass(c.status)}`}>
                      {c.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${badgeClass(c.completion_status)}`}>
                      {c.completion_status || "not_submitted"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${badgeClass(c.payment_status)}`}>
                      {c.payment_status || "unpaid"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">

                    {c.completion_status === "not_submitted" && (
                      <Link
                        href={`/vendor/contracts/${c.id}/complete`}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700"
                      >
                        Submit Completion
                      </Link>
                    )}

                    {c.completion_status === "needs_revision" && (
                      <Link
                        href={`/vendor/contracts/${c.id}/complete`}
                        className="rounded-lg bg-orange-600 px-3 py-2 text-xs text-white hover:bg-orange-700"
                      >
                        Edit & Resubmit
                      </Link>
                    )}

                    {c.completion_status === "submitted" && (
                      <span className="text-xs text-gray-500">
                        Submitted
                      </span>
                    )}

                    {c.completion_status === "approved" && (
                      <span className="text-xs text-green-600">
                        Approved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}