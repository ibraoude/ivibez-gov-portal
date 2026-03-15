
// app/(protected)/contracts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";
import Link from "next/dist/client/link";
import ContractsDashboard from "@/components/contracts/ContractsDashboard";

type ContractRow = {
  id: string;
  contract_number: string;
  tracking_id: string;
  source_request_id: string | null;
  source_type: string;

  gov_type: string | null;
  title: string | null;
  description: string | null;

  status: string | null;

  progress_percentage: number | null;

  final_amount: number | null;

  completion_status?: string | null;
  payment_status?: string | null;

  vendor_id?: string | null;

  period_of_performance: string | null;
  period_start: string | null;

  created_at: string | null;
  updated_at: string | null;
};

  function statusClasses(status?: string | null) {
    const s = (status || "").toLowerCase();

    if (s === "active") return "bg-blue-100 text-blue-800";
    if (s === "at_risk") return "bg-amber-100 text-amber-800";
    if (s === "completed") return "bg-green-100 text-green-800";

    if (s === "submitted") return "bg-yellow-100 text-yellow-800";
    if (s === "under_review") return "bg-orange-100 text-orange-800";
    if (s === "needs_revision") return "bg-red-100 text-red-800";

    if (s === "pending") return "bg-indigo-100 text-indigo-800";
    if (s === "paid") return "bg-green-100 text-green-800";

    if (s === "paused") return "bg-gray-200 text-gray-700";
    if (s === "cancelled") return "bg-rose-100 text-rose-700";

    return "bg-gray-100 text-gray-700";
  }

function money(n: number | null) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  } catch {
    return String(n);
  }
}

const supabase = createClient();

export default function ContractsPage() {
  return (
    <ProtectedPage permission="viewReports">
      <ContractsPageContent />
    </ProtectedPage>
  );
}
function ContractsPageContent() {
  const router = useRouter();

  // ✅ Hooks at top level (unconditional)
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"created_at" | "contract_number" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");


  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
      return;
    }

    await loadContracts();
  }

  async function loadContracts() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        tracking_id,
        source_request_id,
        source_type,
        gov_type,
        title,
        description,
        status,
        progress_percentage,
        final_amount,
        completion_status,
        payment_status,
        vendor_id,
        period_of_performance,
        period_start,
        created_at,
        updated_at
      `)
      .returns<ContractRow[]>();

    if (error) {
      setError(error.message);
      setContracts([]);
      setLoading(false);
      return;
    }

    setContracts(data ?? []);
    setLoading(false);
  }

  const filtered: ContractRow[] = (() => {
    const needle = q.trim().toLowerCase();
    let rows = contracts;

    if (needle) {
      rows = rows.filter((c: ContractRow) => {
        return (
          (c.contract_number || "").toLowerCase().includes(needle) ||
          (c.tracking_id || "").toLowerCase().includes(needle) ||
          (c.title || "").toLowerCase().includes(needle) ||
          (c.status || "").toLowerCase().includes(needle) ||
          (c.gov_type || "").toLowerCase().includes(needle)
        );
      });
    }

    rows = [...rows].sort((a: ContractRow, b: ContractRow) => {
      const dir = sortDir === "asc" ? 1 : -1;

      const av = a[sortKey] as unknown;
      const bv = b[sortKey] as unknown;

      // dates
      if (sortKey === "created_at") {
        const ad = typeof av === "string" ? new Date(av).getTime() : 0;
        const bd = typeof bv === "string" ? new Date(bv).getTime() : 0;
        return (ad - bd) * dir;
      }

      return String((av as string) ?? "").localeCompare(String((bv as string) ?? "")) * dir;
    });

    return rows;
  })();

  async function handleDelete(id: string) {
    const ok = confirm("Delete this contract? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadContracts();
  }

    // ===== KPIs =====
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((c) => (c.status || "").toLowerCase() === "active").length;
  const completedContracts = contracts.filter((c) => (c.status || "").toLowerCase() === "completed").length;
  const atRiskContracts = contracts.filter((c) => (c.status || "").toLowerCase() === "at_risk").length;
  const portfolioValue = contracts.reduce((sum, c) => sum + (c.final_amount || 0), 0);
  const activeExposure = contracts
    .filter((c) => (c.status ?? "") === "active")
    .reduce((sum, c) => sum + (c.final_amount ?? 0), 0);

  const pendingPayments = contracts.filter(
    (c) => (c.payment_status || "").toLowerCase() === "pending"
  ).length;

  const submittedCompletion = contracts.filter(
    (c) => (c.completion_status || "").toLowerCase() === "submitted"
  ).length;



  return (
    <main className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contract Management</h1>
          <p className="text-sm text-gray-600">Search, create, update, and track contract progress.</p>
        </div>

        <Link
          href="/contracts/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          + New Contract
        </Link>
      </div>

      <ContractsDashboard contracts={contracts} />

      <div className="grid gap-4 md:grid-cols-6">
        <KPI title="Total" value={totalContracts} />
        <KPI title="Active" value={activeContracts} />
        <KPI title="At Risk" value={atRiskContracts} />
        <KPI title="Completed" value={completedContracts} />
        <KPI title="Portfolio Value" value={`$${portfolioValue.toLocaleString()}`} />
        <KPI title="Active Exposure" value={`$${activeExposure.toLocaleString()}`} />
        <KPI title="Pending Payments" value={pendingPayments} />
        <KPI title="Completion Submitted" value={submittedCompletion} />
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by contract #, tracking id, title, status..."
          className="w-full md:w-[420px] rounded-lg border px-3 py-2 text-sm"
        />

        <div className="flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="created_at">Sort: Created</option>
            <option value="contract_number">Sort: Contract #</option>
            <option value="status">Sort: Status</option>
          </select>

          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as typeof sortDir)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>

          <button
            onClick={loadContracts}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {/* List */}
        <section className="lg:col-span-2 rounded-lg border bg-white">
          <div className="border-b px-4 py-3 font-medium">Contracts</div>

          {loading ? (
            <div className="p-4 text-sm text-gray-600">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No contracts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-2">Contract #</th>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Completion</th>
                    <th className="px-4 py-2">Payment</th>
                    <th className="px-4 py-2">Progress</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium">{c.contract_number}</div>
                        <div className="text-xs text-gray-500">{c.tracking_id}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{c.title || "—"}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{c.gov_type || "—"}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusClasses(c.status)}`}>
                          {(c.status || "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusClasses(c.completion_status)}`}>
                          {(c.completion_status || "not_submitted").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusClasses(c.payment_status)}`}>
                          {(c.payment_status || "unpaid").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded bg-gray-200">
                            <div
                              className="h-2 rounded bg-blue-600"
                              style={{ width: `${Math.max(0, Math.min(100, c.progress_percentage ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{c.progress_percentage ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">{money(c.final_amount)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">

                          <a
                            href={`/contracts/${c.id}`}
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                          >
                            View
                          </a>

                          <a
                            href={`/contracts/completion-review`}
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                          >
                            Reviews
                          </a>

                          <a
                            href={`/contracts/payment-approval`}
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                          >
                            Payment
                          </a>

                          <button
                            onClick={() => handleDelete(c.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </div>
          </main>
          );
}

/* ================= Components ================= */
function KPI({ title, value }: { title: string; value: number | string | React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
``
