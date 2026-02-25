'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ContractStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "completed"
  | "closed"
  | "terminated";

type GovType = "federal" | "state" | "local";

type Contract = {
  id: string;
  contract_number: string;
  tracking_id: string;
  gov_type: GovType | null;
  title: string | null;
  description?: string | null;

  status: ContractStatus | null;
  progress_percentage: number | null;
  final_amount: number | null;
  period_of_performance: string | null;

  created_at: string | null;
  last_updated: string | null;
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [govFilter, setGovFilter] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedAmount, setEditedAmount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setContracts((data as Contract[]) || []);

    setLoading(false);
  }

  async function updateContractStatus(id: string, status: ContractStatus) {
    const existing = contracts.find(c => c.id === id);
    const oldStatus = existing?.status ?? null;

    const { error } = await supabase
      .from("contracts")
      .update({
        status,
        last_updated: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to update contract status.");
      return;
    }

    // audit log (optional – if table exists + RLS allows)
    const audit = await supabase.from("contract_updates").insert({
      contract_id: id,
      change_type: "status_change",
      old_value: { status: oldStatus },
      new_value: { status },
      note: `Status changed from ${oldStatus ?? "—"} → ${status}`,
    });

    if (audit.error) {
      // don’t block UX if audit insert fails
      console.warn("Audit log insert failed:", audit.error);
    }

    await loadContracts();
  }

  function daysBetween(a: Date, b: Date) {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  }

  function isAutoAtRisk(c: Contract) {
    const status = c.status ?? "draft";
    if (status === "at_risk") return true;

    const now = new Date();
    const created = c.created_at ? new Date(c.created_at) : null;
    const updated = c.last_updated ? new Date(c.last_updated) : null;

    // stale update (14+ days)
    if (status === "active" && updated) {
      const staleDays = daysBetween(now, updated);
      if (staleDays >= 14) return true;
    }

    // low progress after 30 days
    if (status === "active" && created) {
      const ageDays = daysBetween(now, created);
      const progress = c.progress_percentage ?? 0;
      if (ageDays >= 30 && progress < 10) return true;
    }

    return false;
  }

  const filtered = useMemo(() => {
    let result = [...contracts];

    if (statusFilter) {
      result = result.filter(c => (c.status ?? "") === statusFilter);
    }

    if (govFilter) {
      result = result.filter(c => (c.gov_type ?? "") === govFilter);
    }

    return result;
  }, [contracts, statusFilter, govFilter]);

  const handleSave = async (id: string) => {
    if (editedAmount == null) return;

    setSaving(true);

    const { error } = await supabase
      .from("contracts")
      .update({ final_amount: editedAmount })
      .eq("id", id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to update amount");
      return;
    }

    setContracts((prev) =>
      prev.map((contract) =>
        contract.id === id
          ? { ...contract, final_amount: editedAmount }
          : contract
      )
    );
  };

  // ===== KPI Calculations (consistent with auto-risk logic) =====
  const totalContracts = contracts.length;

  const activeContracts = contracts.filter(c => (c.status ?? "") === "active").length;

  const completedContracts = contracts.filter(c => (c.status ?? "") === "completed").length;

  const atRiskContracts = contracts.filter(c => isAutoAtRisk(c)).length;

  const portfolioValue = contracts.reduce((sum, c) => sum + (c.final_amount ?? 0), 0);

  const activeExposure = contracts
    .filter(c => (c.status ?? "") === "active")
    .reduce((sum, c) => sum + (c.final_amount ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Contract Portfolio</h1>

        <Link
          href="/admin/contracts/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          + New Contract
        </Link>
      </div>

      {/* KPI ROW */}
      <div className="grid md:grid-cols-6 gap-4">
        <KPI title="Total" value={totalContracts} />
        <KPI title="Active" value={activeContracts} />
        <KPI title="At Risk" value={atRiskContracts} />
        <KPI title="Completed" value={completedContracts} />
        <KPI title="Portfolio Value" value={`$${portfolioValue.toLocaleString()}`} />
        <KPI title="Active Exposure" value={`$${activeExposure.toLocaleString()}`} />
      </div>

      {/* FILTERS */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="at_risk">At Risk</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
          <option value="terminated">Terminated</option>
        </select>

        <select
          value={govFilter}
          onChange={e => setGovFilter(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm"
        >
          <option value="">All Gov Types</option>
          <option value="federal">Federal</option>
          <option value="state">State</option>
          <option value="local">Local</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("");
            setGovFilter("");
          }}
          className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading contracts…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No contracts found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-6 py-3">Contract #</th>
                <th className="px-6 py-3">Gov</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Progress</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(c => {
                const displayStatus: ContractStatus =
                  isAutoAtRisk(c) ? "at_risk" : (c.status ?? "draft");

                return (
                  <tr key={c.id} className="border-t hover:bg-gray-50 align-top">
                    <td className="px-6 py-3 font-medium whitespace-nowrap">
                      {c.contract_number}
                    </td>

                    <td className="px-6 py-3 capitalize">
                      {c.gov_type ?? "—"}
                    </td>

                    <td className="px-6 py-3">
                      {c.title ?? "—"}
                    </td>

                    <td className="px-6 py-3">
                      <StatusBadge status={displayStatus} />
                    </td>

                    <td className="px-6 py-3 w-56">
                      <ProgressBar value={c.progress_percentage ?? 0} />
                      <div className="text-xs text-gray-500 mt-1">
                        {c.progress_percentage ?? 0}%
                      </div>
                    </td>

                    <td className="px-6 py-3 whitespace-nowrap">
                      {editingId === c.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editedAmount ?? c.final_amount ?? 0}
                            onChange={(e) => setEditedAmount(Number(e.target.value))}
                            className="border rounded px-2 py-1 w-28"
                          />

                          <button
                            onClick={() => handleSave(c.id)}
                            disabled={saving}
                            className="text-green-600 font-semibold"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>

                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {c.final_amount != null
                            ? `$${c.final_amount.toLocaleString()}`
                            : "—"}

                          <button
                            onClick={() => {
                              setEditingId(c.id)
                              setEditedAmount(c.final_amount ?? 0)
                            }}
                            className="text-blue-600"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-3 whitespace-nowrap">
                      {new Date(c.last_updated ?? c.created_at ?? new Date().toISOString()).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/contracts/${c.id}`}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg"
                        >
                          Quick View
                        </Link>

                        {displayStatus !== "active" && displayStatus !== "closed" && displayStatus !== "terminated" && (
                          <button
                            onClick={() => updateContractStatus(c.id, "active")}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg"
                          >
                            Mark Active
                          </button>
                        )}

                        {displayStatus !== "at_risk" && displayStatus !== "closed" && displayStatus !== "terminated" && (
                          <button
                            onClick={() => updateContractStatus(c.id, "at_risk")}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg"
                          >
                            Mark At Risk
                          </button>
                        )}

                        {displayStatus !== "completed" && displayStatus !== "closed" && displayStatus !== "terminated" && (
                          <button
                            onClick={() => updateContractStatus(c.id, "completed")}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg"
                          >
                            Mark Completed
                          </button>
                        )}

                        {displayStatus !== "closed" && displayStatus !== "terminated" && (
                          <button
                            onClick={() => updateContractStatus(c.id, "closed")}
                            className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg"
                          >
                            Close
                          </button>
                        )}

                        {displayStatus !== "terminated" && (
                          <button
                            onClick={() => updateContractStatus(c.id, "terminated")}
                            className="px-3 py-1.5 text-xs bg-black text-white rounded-lg"
                          >
                            Terminate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function KPI({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-200 text-gray-700",
    active: "bg-blue-100 text-blue-800",
    at_risk: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800",
    closed: "bg-gray-300 text-gray-800",
    terminated: "bg-black text-white",
  };

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div
        className="bg-green-600 h-3 rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}