
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
import {
  FileText,
  CheckCircle2,
  Lock,
  Filter,
  Download,
  RefreshCcw,
  Loader2,
} from 'lucide-react';

type Role = 'admin' | 'manager' | 'client' | 'auditor';

interface Report {
  id: string;
  report_type: string;
  contract_count: number | null;
  status: 'draft' | 'locked' | string;
  checksum?: string | null;
  approved_at?: string | null;
  approved_by?: string | null; // UUID of auth.users
  created_at: string;
  approver?: { email?: string } | null; // populated via profiles mapping
}

export default function ReportsPage() {
  const router = useRouter();

  // Auth / role
  const [role, setRole] = useState<Role | null>(null);

  // Data + paging
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Filters
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [includeSnapshot, setIncludeSnapshot] = useState<boolean>(true);

  /* ===================== INIT ===================== */
  useEffect(() => {
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          router.replace('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        setRole((profile?.role ?? 'client') as Role);
        await fetchReports(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===================== HELPERS ===================== */

  // Escape % and _ so ilike searches don't over‑match
  const escapeLike = (input: string) => input.replace(/[%_]/g, (m) => '\\' + m);

  // Convert YYYY‑MM‑DD to UTC day bounds (inclusive)
  const startOfDayISO = (d: string) => new Date(`${d}T00:00:00.000Z`).toISOString();
  const endOfDayISO = (d: string) => new Date(`${d}T23:59:59.999Z`).toISOString();

  // Safely parse JSON or capture text for better error messages (prevents "Unexpected end of JSON input")
  async function parseJsonOrText(res: Response) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const text = await res.text(); // guard empty body
      return text ? JSON.parse(text) : {};
    }
    const text = await res.text();
    return { nonJson: true, body: text };
  }

  /* ===================== FETCH REPORTS ===================== */
  async function fetchReports(resetPage = false, newPage?: number) {
    setLoadingList(true);
    try {
      const currentPage = resetPage ? 1 : newPage ?? page;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('reports')
        .select(
          'id, report_type, contract_count, status, checksum, approved_at, approved_by, created_at',
          { count: 'exact' }
        );

      // filters
      if (statusFilter) query = query.eq('status', statusFilter);
      if (startDate) query = query.gte('created_at', startOfDayISO(startDate));
      if (endDate) query = query.lte('created_at', endOfDayISO(endDate));
      if (q.trim()) {
        const term = escapeLike(q.trim());
        query = query.or(`id.ilike.%${term}%,report_type.ilike.%${term}%`);
      }

      // order + range
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);

      const list = (data ?? []) as Report[];
      setTotal(count ?? 0);

      // Approver email mapping (profiles.id == auth.users.id)
      const approverIds = Array.from(new Set(list.map((r) => r.approved_by).filter(Boolean))) as string[];
      let emailsById: Record<string, string> = {};

      if (approverIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', approverIds);

        if (!pErr) {
          emailsById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
        } else {
          console.warn('profiles lookup failed:', pErr);
        }
      }

      const normalized: Report[] = list.map((r) => ({
        ...r,
        approver: r.approved_by ? { email: emailsById[r.approved_by] } : null,
      }));

      setReports(normalized);
      if (resetPage) setPage(1);
    } catch (e: any) {
      console.error('fetchReports error:', e?.message ?? e);
      setReports([]);
      setTotal(0);
    } finally {
      setLoadingList(false);
    }
  }

  /* ===================== ACTIONS ===================== */

  /** Generate report - captcha-free, robust JSON handling */
  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { router.replace('/login'); return; }

      const res = await fetch('/api/compliance-report', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ includeSnapshot }),
      });

      const payload = await parseJsonOrText(res);
      if (!res.ok) {
        const msg = (payload as any)?.error || (payload as any)?.body || `Error generating report (${res.status})`;
        throw new Error(msg);
      }

      await fetchReports(true, 1);
    } catch (e: any) {
      alert(e.message || 'Error generating report');
    } finally {
      setGenerating(false);
    }
  }

  /** Approve & Lock - captcha-free, robust JSON handling */
  async function handleApprove(id: string) {
    if (!id) { alert('Missing report id'); return; }
    setApprovingId(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { router.replace('/login'); return; }

      const res = await fetch(`/api/reports/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await parseJsonOrText(res);
      if (!res.ok) {
        const msg = (payload as any)?.error || (payload as any)?.body || `Approval failed (${res.status})`;
        throw new Error(msg);
      }

      await fetchReports(false);
    } catch (e: any) {
      alert(e.message || 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  }

  /** Download JSON snapshot (reads snapshot via RLS) */
  async function handleDownloadJSON(id: string) {
    setDownloadingId(id);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, snapshot, created_at')
        .eq('id', id)
        .single();

      if (error) throw error;

      const fileName = `report-${id}-${new Date(data.created_at || Date.now())
        .toISOString()
        .slice(0, 10)}.json`;

      downloadBlob(
        fileName,
        JSON.stringify((data as any).snapshot ?? {}, null, 2),
        'application/json;charset=utf-8;'
      );
    } catch (e: any) {
      alert(e.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  // Export current list view to CSV
  function exportListCSV() {
    const rows = [
      ['ID', 'Type', 'Status', 'Contracts', 'Checksum', 'Approved By', 'Approved At', 'Created'],
      ...reports.map((r) => [
        r.id,
        r.report_type,
        r.status,
        String(r.contract_count ?? 0),
        r.checksum ?? '',
        r.approver?.email ?? '',
        r.approved_at ? new Date(r.approved_at).toLocaleString() : '',
        r.created_at ? new Date(r.created_at).toLocaleString() : '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadBlob('reports.csv', csv, 'text/csv;charset=utf-8;');
  }

  function downloadBlob(filename: string, data: string, type = 'text/plain;charset=utf-8;') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ===================== DERIVED ===================== */

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGenerate = role === 'admin' || role === 'manager';
  const canApprove = role === 'admin' || role === 'manager';

  /* ===================== RENDER ===================== */

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl bg-white shadow" />
          <div className="h-24 animate-pulse rounded-xl bg-white shadow" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Compliance Reports</h1>
              <p className="text-xs text-gray-500">Create, approve, and download portfolio snapshots.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border bg-white p-2">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={includeSnapshot}
                  onChange={(e) => setIncludeSnapshot(e.target.checked)}
                />
                Include snapshot data
              </label>
            </div>

            {canGenerate && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {generating ? 'Generating…' : 'Generate New Report'}
              </button>
            )}

            <button
              onClick={exportListCSV}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Filters */}
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              placeholder="Search (ID or Type)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="locked">Locked</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setQ('');
                  setStatusFilter('');
                  setStartDate('');
                  setEndDate('');
                  fetchReports(true);
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                  fetchReports(true);
                }}
                className="rounded-lg border px-2 py-1 text-xs"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1 || loadingList}
                  onClick={() => {
                    const next = Math.max(1, page - 1);
                    setPage(next);
                    fetchReports(false, next);
                  }}
                  className="rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-2 text-xs text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages || loadingList}
                  onClick={() => {
                    const next = Math.min(totalPages, page + 1);
                    setPage(next);
                    fetchReports(false, next);
                  }}
                  className="rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <button
                onClick={() => fetchReports(true)}
                disabled={loadingList}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* Reports list */}
        <section className="rounded-xl border bg-white shadow-sm">
          {loadingList ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No reports found.</div>
          ) : (
            <div className="divide-y">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-6 py-4">
                  {/* Left block */}
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="mt-1">
                      {r.status === 'locked' ? (
                        <Lock className="h-5 w-5 text-green-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {prettyType(r.report_type)} • {r.id}
                        </h3>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 grid gap-x-6 gap-y-1 text-xs text-gray-600 md:grid-cols-3">
                        <div>
                          Created:{' '}
                          <span className="font-medium text-gray-800">
                            {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                          </span>
                        </div>
                        <div>
                          Contracts:{' '}
                          <span className="font-medium text-gray-800">{r.contract_count ?? 0}</span>
                        </div>
                        <div className="truncate">
                          Checksum:{' '}
                          <span className="font-mono text-[11px] text-gray-800">
                            {r.checksum ? r.checksum.slice(0, 12) + '…' : '—'}
                          </span>
                        </div>
                        {r.status === 'locked' && (
                          <div className="col-span-3">
                            Approved by:{' '}
                            <span className="font-medium text-gray-800">{r.approver?.email ?? 'Unknown'}</span> on{' '}
                            <span className="font-medium text-gray-800">
                              {r.approved_at ? new Date(r.approved_at).toLocaleString() : '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {/* View */}
                    <Link
                      href={`/reports/${r.id}`}
                      className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      View
                    </Link>

                    {/* Download JSON */}
                    <button
                      onClick={() => handleDownloadJSON(r.id)}
                      disabled={downloadingId === r.id}
                      className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-60"
                    >
                      {downloadingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      JSON
                    </button>

                    {/* Approve & Lock */}
                    {r.status === 'draft' && canApprove && (
                      <button
                        onClick={() => r.id && handleApprove(r.id)}
                        disabled={approvingId === r.id || !r.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {approvingId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {approvingId === r.id ? 'Approving…' : 'Approve & Lock'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ===================== UI bits ===================== */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    locked: 'bg-green-100 text-green-800',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function prettyType(t: string) {
  return t.replace(/_/g, ' ');
}
