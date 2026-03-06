
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award as AwardIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Info,
  Loader2,
  Search,
  SortAsc,
  SortDesc,
  TriangleAlert,
  X,
} from "lucide-react";

/* ===================== Types ===================== */

type ServiceStatus = "pending" | "in_progress" | "completed" | "rejected";
type AdminStatus =
  | "submitted"
  | "under_review"
  | "needs_revision"
  | "awarded"
  | "active"
  | "completed"
  | "closed";

type ReqRow = {
  id: string;
  org_id: string;
  tracking_id: string;
  gov_type: string;
  status: ServiceStatus;
  requester_email: string | null;
  title: string | null;
  created_at: string;
  awarded: boolean;
  admin_status: AdminStatus | null;
  contract_number?: string | null;
  progress_percentage?: number | null;
  last_updated?: string | null;
};

type SortKey =
  | "tracking_id"
  | "gov_type"
  | "title"
  | "requester_email"
  | "created_at"
  | "status"
  | "admin_status";

/* ===================== Styling helpers ===================== */

const statusStyles: Record<ServiceStatus, string> = {
  pending:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  in_progress:
    "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  completed:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  rejected:
    "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20",
};

const adminStyles: Record<AdminStatus, string> = {
  submitted:
    "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10",
  under_review:
    "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20",
  needs_revision:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  awarded:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  active:
    "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  completed:
    "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20",
  closed:
    "bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-400/10 dark:text-zinc-300 dark:ring-zinc-400/20",
};

/* ===================== Page ===================== */

export default function AdminRequestsPage() {
  const router = useRouter();

  // Role
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Data (paged from server; RLS enforced)
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters / search / sort / pagination
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [total, setTotal] = useState<number>(0);

  // Selection/bulk
  const [selected, setSelected] = useState<string[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Drawer
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { id: string; stage: string; note?: string | null; actor_email?: string | null; created_at: string }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ id: number; title: string; kind?: "success" | "error" | "info" } | null>(null);
  const toastId = useRef(0);

  // Realtime channel
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ===================== INIT (auth + role) ===================== */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.push("/login");
          return;
        }

        // RLS‑safe role check: read own profile
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (pErr || !profile) {
          setIsAdmin(false);
        } else {
          setIsAdmin(["admin", "manager"].includes(profile.role));
        }

        await loadPage(true);

        // Realtime (RLS‑aware) → refresh on changes
        const channel = supabase
          .channel("awards_realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "service_requests" },
            () => loadPage(false)
          )
          .subscribe();

        channelRef.current = channel;
      } finally {
        setChecking(false);
      }
    })();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ===================== RLS‑safe loader (server-side paging/filter) ===================== */

  // Escape user input for ilike
  const escapeLike = (input: string) => input.replace(/[%_]/g, (m) => "\\" + m);

  async function loadPage(resetToFirst = false) {
    setLoading(true);
    setErrorMsg(null);
    setSelected([]);

    try {
      const currentPage = resetToFirst ? 1 : page;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("service_requests")
        .select(
          "id,tracking_id,gov_type,status,requester_email,title,created_at,awarded,admin_status",
          { count: "exact" }
        );

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (search.trim()) {
        const term = escapeLike(search.trim());
        // Search tracking_id, title, requester_email
        query = query.or(
          `tracking_id.ilike.%${term}%,title.ilike.%${term}%,requester_email.ilike.%${term}%`,
          { referencedTable: "service_requests" }
        );
      }

      // Sort: map UI sort columns to server columns where possible
      const sortableColumns: Partial<Record<SortKey, string>> = {
        created_at: "created_at",
        tracking_id: "tracking_id",
        gov_type: "gov_type",
        requester_email: "requester_email",
        status: "status",
        admin_status: "admin_status",
        // title can be heavy to sort on; include anyway
        title: "title",
      };
      const serverCol = sortableColumns[sortKey] ?? "created_at";
      query = query.order(serverCol, { ascending: sortDir === "asc" });

      // Range for paging
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        setRows([]);
        setTotal(0);
        setErrorMsg(error.message);
      } else {
        setRows((data as ReqRow[]) ?? []);
        setTotal(count ?? 0);
        if (resetToFirst) setPage(1);
      }
    } finally {
      setLoading(false);
    }
  }

  /* ===================== Actions (RLS-enforced) ===================== */

  function showToast(title: string, kind: "success" | "error" | "info" = "info") {
    toastId.current += 1;
    setToast({ id: toastId.current, title, kind });
    setTimeout(() => setToast(null), 2200);
  }

  function toggleSelectAll(checked: boolean, currentPageRows: ReqRow[]) {
    if (checked) {
      const ids = currentPageRows.map((r) => r.id);
      setSelected((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      const ids = new Set(currentPageRows.map((r) => r.id));
      setSelected((prev) => prev.filter((id) => !ids.has(id)));
    }
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function updateStatus(id: string, status: ServiceStatus) {
    setBusyIds((b) => [...b, id]);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id); // RLS decides if allowed
      if (error) showToast(error.message || "Failed to update status", "error");
      else showToast("Status updated", "success");
    } finally {
      setBusyIds((b) => b.filter((x) => x !== id));
      await loadPage(false);
    }
  }

  async function updateAdminStatus(id: string, newAdminStatus: AdminStatus) {
    setBusyIds((b) => [...b, id]);
    try {
      const { data: request, error: fetchError } = await supabase
        .from("service_requests")
        .select("id,awarded,status")
        .eq("id", id)
        .single();

      if (fetchError || !request) {
        showToast("Could not load request", "error");
        return;
      }

      // If switching to 'awarded', call secure server route (RLS + role on server)
      if (newAdminStatus === "awarded" && !request.awarded) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/contracts/award", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ requestId: id }),
        });

        // Read text (then try JSON) to avoid "Unexpected end of JSON input"
        const bodyText = await res.text();
        if (!res.ok) {
          try {
            const j = bodyText ? JSON.parse(bodyText) : {};
            showToast(j.error || `Award failed (${res.status})`, "error");
          } catch {
            showToast(bodyText || `Award failed (${res.status})`, "error");
          }
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("service_requests")
        .update({
          admin_status: newAdminStatus,
          awarded: newAdminStatus === "awarded" ? true : request.awarded,
          status: newAdminStatus === "awarded" ? ("completed" as ServiceStatus) : request.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) showToast(updateError.message || "Failed to update admin stage", "error");
      else showToast("Admin stage updated", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Unexpected error", "error");
    } finally {
      setBusyIds((b) => b.filter((x) => x !== id));
      await loadPage(false);
    }
  }

  // Bulk: award selected via server route (each will pass RLS on server)
  async function bulkAward() {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      for (const id of selected) {
        const res = await fetch("/api/contracts/award", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ requestId: id }),
        });

        if (!res.ok) {
          const t = await res.text();
          try {
            const j = t ? JSON.parse(t) : {};
            showToast(j.error || `Award failed (${res.status})`, "error");
          } catch {
            showToast(t || `Award failed (${res.status})`, "error");
          }
        } else {
          // best-effort local update; true state comes from reload
          await supabase
            .from("service_requests")
            .update({
              admin_status: "awarded",
              awarded: true,
              status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        }
      }
      showToast("Selected requests awarded", "success");
      setSelected([]);
    } catch (e) {
      console.error(e);
      showToast("Bulk award failed", "error");
    } finally {
      setBulkBusy(false);
      await loadPage(false);
    }
  }

  // Bulk: close selected (RLS enforced)
  async function bulkClose() {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ admin_status: "closed", updated_at: new Date().toISOString() })
        .in("id", selected);
      if (error) showToast(error.message || "Bulk close failed", "error");
      else showToast("Selected requests closed", "success");
      setSelected([]);
    } catch (e) {
      console.error(e);
      showToast("Bulk close failed", "error");
    } finally {
      setBulkBusy(false);
      await loadPage(false);
    }
  }

  /* ===================== Sorting (client only for secondary columns) ===================== */

  function onSort(col: SortKey) {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(col);
      setSortDir(col === "created_at" ? "desc" : "asc");
    }
    // Ask server to re-load using mapped column where possible
    void loadPage(false);
  }

  const filtered = useMemo(() => rows, [rows]); // server already filtered
  const sorted = useMemo(() => {
    // Server already sorts by the chosen column when possible;
    // keep a client sort fallback for secondary keys or when equal.
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      const va = (a[sortKey] ?? "").toString().toLowerCase();
      const vb = (b[sortKey] ?? "").toString().toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    // We already request a specific range from server;
    // this slice just mirrors server paging for render safety.
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  // Refresh to first page on filter changes
  useEffect(() => {
    setPage(1);
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, pageSize, sortKey, sortDir]);

  /* ===================== Drawer / Timeline ===================== */

  async function openDrawer(id: string) {
    setDrawerId(id);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const { data, error } = await supabase
        .from("service_request_activity")
        .select("id, stage, note, actor_email, created_at")
        .eq("request_id", id)
        .order("created_at", { ascending: true });
      if (!error && data) setHistory(data as any);
    } finally {
      setHistoryLoading(false);
    }
  }
  function closeDrawer() {
    setDrawerId(null);
    setHistory([]);
  }

  /* ===================== CSV Export (current server-filtered set) ===================== */

  function exportCSV() {
    const headers = [
      "Tracking ID",
      "Type",
      "Title",
      "Requester",
      "Created",
      "Status",
      "Admin Stage",
      "Awarded",
    ];
    const lines = sorted.map((r) => [
      r.tracking_id,
      r.gov_type,
      sanitize(r.title),
      r.requester_email ?? "",
      new Date(r.created_at).toISOString(),
      r.status,
      r.admin_status ?? "",
      r.awarded ? "yes" : "no",
    ]);

    const csv =
      headers.join(",") +
      "\n" +
      lines
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `requests_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ===================== Render ===================== */

  if (checking) return null;

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 dark:bg-black dark:text-gray-100">
      <div className="mx-auto flex h-screen max-w-[1600px] flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-white/5 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Project Lifecycle Management</h1>
            <p className="text-xs text-gray-600 dark:text-gray-400">Full‑screen console for awards & lifecycle.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter */}
            <div className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5">
              <Filter className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Search */}
            <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5">
              <Search className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tracking, title, requester…"
                className="w-64 bg-transparent outline-none"
              />
            </div>

            {/* Export */}
            <button
              onClick={exportCSV}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Bulk bar */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-white/10 dark:bg-black/40 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-gray-600 dark:text-gray-400">
              {selected.length ? `${selected.length} selected` : "Select rows to enable bulk actions"}
            </span>
          </div>

          {/* Role-based visibility */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={bulkAward}
                disabled={!selected.length || bulkBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AwardIcon className="h-3.5 w-3.5" />}
                Award
              </button>
              <button
                onClick={bulkClose}
                disabled={!selected.length || bulkBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 disabled:opacity-60"
              >
                Close
              </button>

              {/* Page size */}
              <div className="ml-2 inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5">
                <span className="mr-1 text-gray-500">Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-transparent outline-none"
                >
                  {[10, 20, 50, 100].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                {errorMsg && (
                  <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
                    Failed to load requests: {errorMsg}
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      <tr>
                        <Th className="w-10">
                          <input
                            type="checkbox"
                            checked={pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id))}
                            onChange={(e) => toggleSelectAll(e.currentTarget.checked, pageRows)}
                          />
                        </Th>
                        <SortableTh label="Tracking ID" active={sortKey === "tracking_id"} dir={sortDir} onClick={() => onSort("tracking_id")} />
                        <SortableTh label="Type" active={sortKey === "gov_type"} dir={sortDir} onClick={() => onSort("gov_type")} />
                        <SortableTh label="Title" active={sortKey === "title"} dir={sortDir} onClick={() => onSort("title")} />
                        <SortableTh label="Requester" active={sortKey === "requester_email"} dir={sortDir} onClick={() => onSort("requester_email")} />
                        <SortableTh label="Created" active={sortKey === "created_at"} dir={sortDir} onClick={() => onSort("created_at")} />
                        <SortableTh label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => onSort("status")} />
                        <SortableTh label="Admin Stage" active={sortKey === "admin_status"} dir={sortDir} onClick={() => onSort("admin_status")} />
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {loading ? (
                        <tr>
                          <td colSpan={9} className="px-5 py-6">
                            <SkeletonRows />
                          </td>
                        </tr>
                      ) : pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                            No requests found.
                          </td>
                        </tr>
                      ) : (
                        <AnimatePresence initial={false}>
                          {pageRows.map((r) => (
                            <motion.tr
                              key={r.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.15 }}
                              className="bg-white dark:bg-transparent"
                            >
                              <Td className="w-10">
                                <input
                                  type="checkbox"
                                  checked={selected.includes(r.id)}
                                  onChange={(e) => toggleRow(r.id, e.currentTarget.checked)}
                                />
                              </Td>

                              <Td className="font-semibold">
                                <button
                                  onClick={() => openDrawer(r.id)}
                                  className="hover:underline"
                                  title="View details"
                                >
                                  {r.tracking_id}
                                </button>
                              </Td>
                              <Td className="capitalize">
                                <span className="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10">
                                  {r.gov_type}
                                </span>
                              </Td>
                              <Td className="max-w-[320px] truncate">{r.title || "—"}</Td>
                              <Td className="max-w-[260px] truncate">{r.requester_email || "—"}</Td>
                              <Td>{formatDate(r.created_at)}</Td>

                              <Td>
                                <div className="inline-flex items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[r.status]}`}>
                                    {labelize(r.status)}
                                  </span>
                                  {isAdmin && (
                                    <SelectSmall
                                      disabled={busyIds.includes(r.id)}
                                      value={r.status}
                                      onChange={(val) => updateStatus(r.id, val as ServiceStatus)}
                                      options={["pending", "in_progress", "completed", "rejected"]}
                                    />
                                  )}
                                </div>
                              </Td>

                              <Td>
                                <div className="inline-flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                      adminStyles[(r.admin_status || "submitted") as AdminStatus]
                                    }`}
                                  >
                                    {labelize(r.admin_status || "submitted")}
                                  </span>
                                  {isAdmin && (
                                    <SelectSmall
                                      disabled={busyIds.includes(r.id)}
                                      value={r.admin_status || "submitted"}
                                      onChange={(val) => updateAdminStatus(r.id, val as AdminStatus)}
                                      options={[
                                        "submitted",
                                        "under_review",
                                        "needs_revision",
                                        "awarded",
                                        "active",
                                        "completed",
                                        "closed",
                                      ]}
                                    />
                                  )}
                                </div>
                              </Td>

                              <Td align="right">
                                {r.awarded ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Awarded
                                  </span>
                                ) : isAdmin ? (
                                  <button
                                    disabled={busyIds.includes(r.id)}
                                    onClick={async () => {
                                      setBusyIds((b) => [...b, r.id]);
                                      try {
                                        const { data: sessionData } = await supabase.auth.getSession();
                                        const token = sessionData.session?.access_token;
                                        const res = await fetch("/api/contracts/award", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                          },
                                          body: JSON.stringify({ requestId: r.id }),
                                        });
                                        const text = await res.text();
                                        if (!res.ok) {
                                          try {
                                            const j = text ? JSON.parse(text) : {};
                                            showToast(j.error || `Award failed (${res.status})`, "error");
                                          } catch {
                                            showToast(text || `Award failed (${res.status})`, "error");
                                          }
                                        } else {
                                          await supabase
                                            .from("service_requests")
                                            .update({
                                              admin_status: "awarded",
                                              awarded: true,
                                              status: "completed",
                                              updated_at: new Date().toISOString(),
                                            })
                                            .eq("id", r.id);
                                          showToast("Contract awarded", "success");
                                          await loadPage(false);
                                        }
                                      } catch (e) {
                                        console.error(e);
                                        showToast("Award failed", "error");
                                      } finally {
                                        setBusyIds((b) => b.filter((x) => x !== r.id));
                                      }
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {busyIds.includes(r.id) ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <AwardIcon className="h-3.5 w-3.5" />
                                    )}
                                    Award
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">No actions</span>
                                )}
                              </Td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-white/10">
                  <span className="text-gray-600 dark:text-gray-400">
                    {total
                      ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, total)} of ${total}`
                      : "—"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2">{currentPage} / {totalPages || 1}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer */}
              <AnimatePresence>
                {drawerId && (
                  <motion.div
                    className="fixed inset-0 z-50 flex"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
                    <motion.aside
                      initial={{ x: 420 }}
                      animate={{ x: 0 }}
                      exit={{ x: 420 }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      className="ml-auto flex h-full w-full max-w-[420px] flex-col overflow-hidden border-l border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-950"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-gray-500" />
                          <h3 className="text-sm font-semibold">Request Details</h3>
                        </div>
                        <button onClick={closeDrawer} className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-white/10">
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-auto px-4 py-4">
                        {/* Current row snapshot */}
                        {(() => {
                          const row = rows.find((x) => x.id === drawerId);
                          if (!row) return null;
                          return (
                            <div className="space-y-2">
                              <DetailRow label="Tracking ID" value={row.tracking_id} />
                              <DetailRow label="Type" value={row.gov_type} />
                              <DetailRow label="Title" value={row.title || "—"} />
                              <DetailRow label="Requester" value={row.requester_email || "—"} />
                              <DetailRow label="Created" value={formatDate(row.created_at)} />
                              <DetailRow label="Status" value={labelize(row.status)} />
                              <DetailRow label="Admin Stage" value={labelize(row.admin_status || "submitted")} />
                              <DetailRow label="Awarded" value={row.awarded ? "Yes" : "No"} />
                            </div>
                          );
                        })()}

                        {/* Timeline */}
                        <div className="mt-6">
                          <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
                          {historyLoading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading history…
                            </div>
                          ) : history.length === 0 ? (
                            <div className="text-sm text-gray-500">No timeline entries yet.</div>
                          ) : (
                            <ol className="relative ml-3 border-l border-gray-200 dark:border-white/10">
                              {history.map((h) => (
                                <li key={h.id} className="mb-4 ml-4">
                                  <div className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-blue-500" />
                                  <div className="text-sm font-medium">{labelize(h.stage)}</div>
                                  {h.note && <div className="text-sm text-gray-600 dark:text-gray-400">{h.note}</div>}
                                  <div className="text-xs text-gray-500">
                                    {h.actor_email ? `${h.actor_email} • ` : ""}
                                    {formatDate(h.created_at)}
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      </div>
                    </motion.aside>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`pointer-events-none fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-inset
                ${
                  toast.kind === "success"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20"
                    : toast.kind === "error"
                    ? "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20"
                    : "bg-gray-50 text-gray-800 ring-gray-200 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10"
                }`}
            >
              {toast.kind === "error" ? (
                <span className="inline-flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4" />
                  {toast.title}
                </span>
              ) : (
                toast.title
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ===================== Small Components ===================== */

function Th({ children, className = "" }: any) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  return (
    <td className={`px-4 py-3 align-middle text-gray-800 dark:text-gray-200 ${className}`} style={{ textAlign: align }}>
      {children}
    </td>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <Th>
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:underline">
        {label}
        {active ? (dir === "asc" ? <SortAsc className="h-3.5 w-3.5" /> : <SortDesc className="h-3.5 w-3.5" />) : null}
      </button>
    </Th>
  );
}

function SelectSmall({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10">
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labelize(o)}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 opacity-70" />
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-36 shrink-0 text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

/* ===================== Utils ===================== */

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
function labelize(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function sanitize(v: any) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}
