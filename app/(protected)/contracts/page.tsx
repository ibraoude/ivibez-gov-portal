"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from 'next/navigation'

type ContractRow = {
  id: string;
  contract_number: string;
  tracking_id: string;
  source_request_id: string | null;
  source_type: string;
  gov_type: string | null;
  title: string | null;
  description: string | null;
  status: string | null; // default 'active'
  progress_percentage: number | null; // default 0
  final_amount: number | null;
  period_of_performance: string | null;
  period_start: string | null; // date
  created_at: string | null;
  updated_at: string | null;
};

function statusClasses(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "active") return "bg-blue-100 text-blue-800";
  if (s === "at_risk") return "bg-amber-100 text-amber-800";
  if (s === "closed" || s === "completed") return "bg-green-100 text-green-800";
  if (s === "paused" || s === "on hold") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "cancelled" || s === "canceled") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function money(n: number | null) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  } catch {
    return String(n);
  }
}

export default function ContractsPage() {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter()

  // UI state
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"created_at" | "contract_number" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Form state
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const [form, setForm] = useState({
    contract_number: "",
    source_type: "service_request", // or "manual"
    gov_type: "",
    title: "",
    description: "",
    status: "active",
    progress_percentage: 0,
    final_amount: "",
    period_of_performance: "",
    period_start: "",
  });

  // Optional file upload
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadContracts() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("contracts")
      .select(
        "id,contract_number,tracking_id,source_request_id,source_type,gov_type,title,description,status,progress_percentage,final_amount,period_of_performance,period_start,created_at,updated_at"
      );

    if (error) {
      setError(error.message);
      setContracts([]);
      setLoading(false);
      return;
    }

    setContracts((data as ContractRow[]) || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = contracts;

    if (needle) {
      rows = rows.filter((c) => {
        return (
          (c.contract_number || "").toLowerCase().includes(needle) ||
          (c.tracking_id || "").toLowerCase().includes(needle) ||
          (c.title || "").toLowerCase().includes(needle) ||
          (c.status || "").toLowerCase().includes(needle) ||
          (c.gov_type || "").toLowerCase().includes(needle)
        );
      });
    }

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];

      // dates
      if (sortKey === "created_at") {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        return (ad - bd) * dir;
      }

      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });

    return rows;
  }, [contracts, q, sortKey, sortDir]);

  function resetForm() {
    setEditing(null);
    setFile(null);
    setForm({
      contract_number: "",
      source_type: "service_request",
      gov_type: "",
      title: "",
      description: "",
      status: "active",
      progress_percentage: 0,
      final_amount: "",
      period_of_performance: "",
      period_start: "",
    });
  }

  function startEdit(row: ContractRow) {
    setEditing(row);
    setFile(null);
    setForm({
      contract_number: row.contract_number || "",
      source_type: row.source_type || "service_request",
      gov_type: row.gov_type || "",
      title: row.title || "",
      description: row.description || "",
      status: row.status || "active",
      progress_percentage: row.progress_percentage ?? 0,
      final_amount: row.final_amount == null ? "" : String(row.final_amount),
      period_of_performance: row.period_of_performance || "",
      period_start: row.period_start || "",
    });
  }

  async function handleSave() {
    setError(null);

    if (!form.contract_number.trim()) {
      setError("Contract number is required.");
      return;
    }

    const payload: Partial<ContractRow> & { contract_number: string; source_type: string } = {
      contract_number: form.contract_number.trim(),
      source_type: form.source_type,
      gov_type: form.gov_type.trim() || null,
      title: form.title.trim() || null,
      description: form.description.trim() || null,
      status: form.status.trim() || null,
      progress_percentage: Number.isFinite(Number(form.progress_percentage)) ? Number(form.progress_percentage) : 0,
      final_amount: form.final_amount.trim() ? Number(form.final_amount) : null,
      period_of_performance: form.period_of_performance.trim() || null,
      period_start: form.period_start.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Optional: upload file first (if you want to store a link somewhere, you need a column for it)
    // This upload will still work, but it won't be referenced unless you add a column like file_path.
    if (file) {
      await uploadContractFile(file, editing?.id || form.contract_number.trim());
    }

    if (editing?.id) {
      const { error } = await supabase.from("contracts").update(payload).eq("id", editing.id);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      // tracking_id defaults? In your schema tracking_id is NOT NULL.
      // If you don't have a trigger generating it, you MUST generate here:
      const tracking_id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

      const { error } = await supabase.from("contracts").insert({
        ...payload,
        tracking_id,
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    resetForm();
    await loadContracts();
  }

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

  async function uploadContractFile(f: File, key: string) {
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() || "bin";
      const path = `contracts/${key}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from("contract-files").upload(path, f, {
        upsert: true,
        contentType: f.type || "application/octet-stream",
      });

      if (error) {
        setError(`Upload failed: ${error.message}`);
        return;
      }
    } finally {
      setUploading(false);
    }
  }

    // ===== KPIs =====
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((c) => (c.status ?? '') === 'active').length;
  const completedContracts = contracts.filter((c) => (c.status ?? '') === 'completed').length;
  const atRiskContracts = contracts.filter((c) => (c.status ?? '') === 'at_risk').length;
  const portfolioValue = contracts.reduce((sum, c) => sum + (c.final_amount ?? 0), 0);
  const activeExposure = contracts
    .filter((c) => (c.status ?? '') === 'active')
    .reduce((sum, c) => sum + (c.final_amount ?? 0), 0);

  return (
    <main className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contract Management</h1>
          <p className="text-sm text-gray-600">Search, create, update, and track contract progress.</p>
        </div>

        <button
          onClick={() => router.push("/contracts/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          + New Contract
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <KPI title="Total" value={totalContracts} />
        <KPI title="Active" value={activeContracts} />
        <KPI title="At Risk" value={atRiskContracts} />
        <KPI title="Completed" value={completedContracts} />
        <KPI title="Portfolio Value" value={`$${portfolioValue.toLocaleString()}`} />
        <KPI title="Active Exposure" value={`$${activeExposure.toLocaleString()}`} />
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
            onChange={(e) => setSortKey(e.target.value as any)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="created_at">Sort: Created</option>
            <option value="contract_number">Sort: Contract #</option>
            <option value="status">Sort: Status</option>
          </select>

          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as any)}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
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
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                          >
                            Edit
                          </button>
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

        {/* Editor */}
        <aside className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3 font-medium">
            {editing ? "Edit Contract" : "New Contract"}
          </div>

          <div className="space-y-3 p-4">
            <div>
              <label className="text-xs text-gray-600">Contract Number *</label>
              <input
                value={form.contract_number}
                onChange={(e) => setForm((p) => ({ ...p, contract_number: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Source Type</label>
              <select
                value={form.source_type}
                onChange={(e) => setForm((p) => ({ ...p, source_type: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="service_request">service_request</option>
                <option value="manual">manual</option>
                <option value="award">award</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600">Gov Type</label>
              <input
                value={form.gov_type}
                onChange={(e) => setForm((p) => ({ ...p, gov_type: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="at_risk">at_risk</option>
                  <option value="paused">paused</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600">Progress %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress_percentage}
                  onChange={(e) => setForm((p) => ({ ...p, progress_percentage: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Final Amount</label>
                <input
                  value={form.final_amount}
                  onChange={(e) => setForm((p) => ({ ...p, final_amount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. 25000"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Period Start</label>
                <input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Period of Performance</label>
              <input
                value={form.period_of_performance}
                onChange={(e) => setForm((p) => ({ ...p, period_of_performance: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="e.g. 12 months"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Upload File (optional)</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
              {uploading && <div className="mt-1 text-xs text-gray-500">Uploading…</div>}
              <div className="mt-1 text-xs text-gray-500">
                Requires Supabase Storage bucket: <span className="font-mono">contract-files</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                {editing ? "Save Changes" : "Create Contract"}
              </button>

              <button
                onClick={resetForm}
                className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ================= Components ================= */
function KPI({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}