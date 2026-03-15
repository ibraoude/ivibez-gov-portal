
// app/(protected)/audit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRecaptchaToken } from "@/lib/security/recaptcha-client";
import ProtectedPage from "@/components/auth/ProtectedPage";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: JSONValue | undefined;
  created_at: string; // ISO
  user_id: string;
  user_email?: string;
  org_id?: string;
}

const PAGE_SIZE = 15;

export default function AuditPage() {
  return (
    <ProtectedPage permission="viewReports">
      <AuditPageContent />
    </ProtectedPage>
  );
}
function AuditPageContent() {
  const supabase = createClient();

  // ✅ Hooks are at the top level and unconditional
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "insert" | "update" | "delete">("all");
  const [page, setPage] = useState(1);
  const [dark, setDark] = useState(false);
  const [orgFilter, setOrgFilter] = useState("");


  /* ======================================
     FETCH LOGS
  ====================================== */
  const fetchLogs = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("User not found");
        setLoading(false);
        return;
      }

      const recaptchaToken = await getRecaptchaToken("audit_list");

      const res = await fetch("/api/audit/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Request-ID": crypto.randomUUID(),
        },
        body: JSON.stringify({ recaptchaToken }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setError((data as any)?.error || "Failed to load logs");
        return;
      }

      setLogs(((data as any)?.logs ?? []) as AuditLog[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  /* ======================================
     REAL-TIME UPDATES
  ====================================== */
  useEffect(() => {
    const channel = supabase
      .channel("audit-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLogs((prev) => [payload.new as AuditLog, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  /* ======================================
     FILTERING
  ====================================== */
  const s = search.toLowerCase();

  const filteredLogs = logs.filter((log) => {
    const action = (log.action ?? "").toLowerCase();

    if (tab !== "all" && !action.includes(tab)) return false;

    if (orgFilter && log.org_id !== orgFilter) return false;

    if (!s) return true;

    const metadataText =
      log.metadata != null ? JSON.stringify(log.metadata).toLowerCase() : "";

    const entityType = (log.entity_type ?? "").toLowerCase();
    const userEmail = (log.user_email ?? "").toLowerCase();

    return (
      action.includes(s) ||
      entityType.includes(s) ||
      userEmail.includes(s) ||
      metadataText.includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginated = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ======================================
     EXPORT CSV
  ====================================== */
  const exportCSV = () => {
    const headers = ["Date", "Action", "Entity", "User", "IP"];
    const rows = filteredLogs.map((l) => [
      new Date(l.created_at).toISOString(),
      l.action,
      `${l.entity_type} ${l.entity_id || ""}`,
      l.user_email || l.user_id,
      // If your metadata always has an ip string when present:
      typeof (l.metadata as any)?.ip === "string" ? (l.metadata as any).ip : "",
    ]);

    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          r
            .map((x) => String(x).replace(/"/g, '""'))
            .map((x) => `"${x}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_logs.csv";
    a.click();
  };

  /* ======================================
     ANALYTICS HEADER
  ====================================== */
  const inserts = logs.filter((l) => l.action.toLowerCase().includes("insert")).length;
  const updates = logs.filter((l) => l.action.toLowerCase().includes("update")).length;
  const deletes = logs.filter((l) => l.action.toLowerCase().includes("delete")).length;

  // ✅ Early returns happen AFTER hooks (this is fine)
  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;


  return (
    <div
      className={`${
        dark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"
      } min-h-screen p-8 transition-colors duration-300`}
    >
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Platform Audit Logs</h1>
            <p className="text-sm opacity-70">Real-time immutable system history</p>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="px-4 py-2 rounded bg-indigo-600 text-white"
          >
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {/* ANALYTICS */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Stat label="Total" value={logs.length} />
          <Stat label="Inserts" value={inserts} />
          <Stat label="Updates" value={updates} />
          <Stat label="Deletes" value={deletes} />
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search action, user, metadata..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="px-4 py-2 border rounded w-64"
          />

          <select
            value={tab}
            onChange={(e) => {
              setPage(1);
              setTab(e.target.value as typeof tab);
            }}
            className="px-4 py-2 border rounded"
          >
            <option value="all">All</option>
            <option value="insert">Inserts</option>
            <option value="update">Updates</option>
            <option value="delete">Deletes</option>
          </select>

          <input
            type="text"
            placeholder="Filter by org_id"
            value={orgFilter}
            onChange={(e) => {
              setPage(1);
              setOrgFilter(e.target.value);
            }}
            className="px-4 py-2 border rounded"
          />

          <button onClick={exportCSV} className="px-4 py-2 bg-green-600 text-white rounded">
            Export CSV
          </button>
        </div>

        {/* TABLE */}
        <div
          className={`${
            dark ? "bg-gray-900 border border-gray-800" : "bg-white"
          } rounded-xl shadow-lg overflow-x-auto transition-colors`}
        >
          <table className="w-full text-sm">
            <thead
              className={`${
                dark ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-700"
              } text-left`}
            >
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">User</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((log) => (
                <tr
                  key={log.id}
                  className={`${
                    dark ? "border-gray-800 hover:bg-gray-800" : "border-gray-200 hover:bg-gray-50"
                  } border-t transition`}
                >
                  <td className="p-3">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <span
                      className={`px-3 py-1 text-xs rounded-full font-medium ${
                        log.action.toLowerCase().includes("insert")
                          ? "bg-green-100 text-green-700"
                          : log.action.toLowerCase().includes("update")
                          ? "bg-yellow-100 text-yellow-700"
                          : log.action.toLowerCase().includes("delete")
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {log.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    {log.entity_type} {log.entity_id || ""}
                  </td>
                  <td className="p-3">{log.user_email || log.user_id}</td>
                  <td className="p-3">{(log.metadata as any)?.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex justify-between items-center mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* =======================
   STAT CARD
======================= */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded shadow p-4 text-center">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
``
