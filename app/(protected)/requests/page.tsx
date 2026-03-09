//app/(protected)/requests/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'
const supabase = createClient();
import {
  FileText,
  Clock,
  CheckCircle,
  Plus,
  LogOut,
  Shield,
  Pencil,
  Download,
  Filter,
} from 'lucide-react';

type Role = 'admin' | 'manager' | 'client' | 'auditor';
type ContractStatus = 'draft' | 'active' | 'at_risk' | 'completed' | 'closed' | 'terminated';
type GovType = 'federal' | 'state' | 'local';

interface AppUser {
  id: string;
  email: string;
  role: Role;
  org_id: string | null;
}

interface ServiceRequest {
  id: string;
  tracking_id: string;
  gov_type: string;
  status: string;
  title: string;
  created_at: string;
  awarded?: boolean;
}

interface GovernmentContract {
  id: string;
  service_request_id?: string | null;
  contract_number?: string;
  final_amount?: number;
  period_of_performance?: string;
  progress_percentage?: number;
  last_updated?: string;
  admin_status?: string;
  status: ContractStatus | string;
  created_at: string;

  service_requests?: {
    tracking_id: string;
    gov_type: string;
    title: string;
  } | null;
}

export default function RequestsPage() {
  const router = useRouter();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [contracts, setContracts] = useState<GovernmentContract[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    contractId: '',
    gov: '',
    status: '',
    startDate: '',
    endDate: '',
  });

  // Inline amount edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          router.replace(`/login?returnTo=/requests`);
          return;
        }

        const authUser = session.user;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, org_id')
          .eq('id', authUser.id)
          .single();

        if (profileError || !profile) {
          console.error('Profile not found:', profileError);
          router.replace(`/login?returnTo=${encodeURIComponent('/requests')}`);
          return;
        }

        setUser({
          id: authUser.id,
          email: authUser.email!,
          role: (profile.role ?? 'client') as Role,
          org_id: profile.org_id ?? null,
        });

        await Promise.all([fetchRequests(), fetchContracts()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function fetchRequests() {
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id,tracking_id,gov_type,status,title,created_at,awarded")
        .order("created_at", { ascending: false })
        .returns<ServiceRequest[]>();   // ✅ FIX

      if (error) throw error;

      setRequests(data || []);
    } catch (e) {
      console.error("Error fetching requests:", e);
      setRequests([]);
    }
  }

  async function fetchContracts() {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          service_request_id,
          contract_number,
          final_amount,
          period_of_performance,
          progress_percentage,
          last_updated,
          admin_status,
          status,
          created_at,
          service_requests!contracts_service_request_id_fkey (
            tracking_id,
            gov_type,
            title
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row: any) => ({
        ...row,
        service_requests: Array.isArray(row.service_requests)
          ? row.service_requests[0] ?? null
          : row.service_requests ?? null,
      }));
      setContracts(normalized);
    } catch (e) {
      console.error('Error fetching contracts:', e);
      setContracts([]);
    }
  }

  /* ---------- helpers ---------- */
  const today = new Date();

  function parsePeriodEnd(period?: string) {
    if (!period) return null;
    const normalized = period.replace(' - ', ' to ');
    const parts = normalized.split('to');
    const end = parts[1]?.trim();
    if (!end) return null;
    const d = new Date(end);
    return isNaN(d.getTime()) ? null : d;
  }

  function daysSince(dateISO?: string) {
    if (!dateISO) return 999;
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return 999;
    return Math.ceil((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  function isExpiringSoon(c: GovernmentContract) {
    const endDate = parsePeriodEnd(c.period_of_performance);
    if (!endDate) return false;
    const left = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return left <= 60 && left >= 0;
  }

  function behindSchedule(c: GovernmentContract) {
    if (c.status !== 'active') return false;
    const progress = c.progress_percentage ?? 0;
    return progress < 50 && daysSince(c.last_updated) > 30;
  }

  function badgeClass(s: string | null | undefined) {
    const map: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-blue-100 text-blue-800',
      at_risk: 'bg-red-100 text-red-800',
      completed: 'bg-green-100 text-green-800',
      closed: 'bg-gray-300 text-gray-800',
      terminated: 'bg-black text-white',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return map[s ?? ''] ?? 'bg-gray-100 text-gray-800';
  }

  // KPIs
  const portfolioValue = contracts.reduce((sum, c) => sum + (c.final_amount || 0), 0);
  const activeCount = contracts.filter((c) => c.status === 'active').length;
  const expiringSoonCount = contracts.filter(isExpiringSoon).length;
  const avgCompletion =
    contracts.length > 0
      ? Math.round(contracts.reduce((sum, c) => sum + (c.progress_percentage || 0), 0) / contracts.length)
      : 0;
  const behindScheduleCount = contracts.filter(behindSchedule).length;

  // Filters
  const filteredContracts = contracts.filter((c) => {
        const idMatch =
          !filters.contractId ||
          (c.contract_number || c.service_requests?.tracking_id || '')
            .toLowerCase()
            .includes(filters.contractId.toLowerCase());
        const govMatch = !filters.gov || (c.service_requests?.gov_type || '').toLowerCase() === filters.gov.toLowerCase();
        const statusMatch = !filters.status || (c.status || '').toLowerCase() === filters.status.toLowerCase();

        const cDate = c.created_at ? new Date(c.created_at) : null;
        const startMatch = !filters.startDate || (cDate && cDate >= new Date(filters.startDate));
        const endMatch = !filters.endDate || (cDate && cDate <= new Date(filters.endDate));

        return idMatch && govMatch && statusMatch && startMatch && endMatch;
      });
  /* ---------- actions ---------- */

  async function updateContractAmount(id: string) {
    if (editedAmount == null) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('contracts').update({ final_amount: editedAmount }).eq('id', id);
      if (error) throw error;
      setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, final_amount: editedAmount } : c)));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to update amount');
    } finally {
      setSaving(false);
    }
  }

  async function updateContractStatus(id: string, status: ContractStatus) {
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ status, last_updated: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      // best-effort audit (non-blocking)
      try {
        await supabase.from('contract_updates').insert({
          request_id: id,
          update_text: `Status changed to ${status}`,
        });
      } catch {}

      await fetchContracts();
    } catch (e) {
      console.error(e);
      alert('Failed to update contract status.');
    }
  }

  function downloadBlob(filename: string, data: string, type = 'text/csv;charset=utf-8;') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPortfolioCSV() {
    const rows = [
      [
        'Contract/Tracking',
        'Title',
        'Gov Type',
        'Status',
        'Admin Status',
        'Final Amount',
        'Progress %',
        'Period of Performance',
        'Last Updated',
        'Created',
      ],
      ...filteredContracts.map((c) => [
        c.contract_number || c.service_requests?.tracking_id || c.id,
        (c.service_requests?.title || '').replace(/[\r\n]+/g, ' '),
        c.service_requests?.gov_type || '',
        c.status || '',
        c.admin_status || '',
        c.final_amount?.toString() || '',
        (c.progress_percentage ?? 0).toString(),
        c.period_of_performance || '',
        c.last_updated ? new Date(c.last_updated).toLocaleDateString() : '',
        c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob('portfolio.csv', csv);
  }

  
  async function generateComplianceReport() {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        router.replace('/login');
        return;
      }

      const res = await fetch("/api/compliance-report", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ includeSnapshot: true }), // or false if large
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error generating report");

      // Read the count from the explicit key the server returns
      const count = typeof json.contract_count === "number" ? json.contract_count : 0;
      alert(`Report generated. ${count} contracts found.`);
    } catch (e: any) {
      alert(e.message || "Error generating report");
    }
  }


  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/login');
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6">No user found</div>;
  }
  const firstName = user.email?.split('@')[0] ?? 'User';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar (full-width) */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Welcome, {firstName}</h1>
              <p className="text-xs text-gray-500">Here’s the latest on your portfolio.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              Role: {user.role}
            </span>

            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-4 w-4" />
              New Request
            </Link>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-black"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main full-page content */}
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Compliance banner */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Compliance Overview</h2>
              <p className="mt-1 text-sm text-gray-600">
                Monitor contract health, timelines, documentation readiness, and audit traceability.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportPortfolioCSV}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={generateComplianceReport}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Generate Compliance Report
              </button>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid gap-4 md:grid-cols-5">
          <KPI title="Portfolio Value" value={`$${portfolioValue.toLocaleString()}`} />
          <KPI title="Active Contracts" value={activeCount} />
          <KPI title="Expiring ≤ 60 Days" value={expiringSoonCount} />
          <KPI title="Behind Schedule" value={behindScheduleCount} />
          <KPI title="Avg Completion" value={`${avgCompletion}%`} />
        </section>

        {/* Filters */}
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              placeholder="Contract # or Tracking ID"
              value={filters.contractId}
              onChange={(e) => setFilters((f) => ({ ...f, contractId: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <select
              value={filters.gov}
              onChange={(e) => setFilters((f) => ({ ...f, gov: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Gov Types</option>
              <option value="federal">Federal</option>
              <option value="state">State</option>
              <option value="local">Local</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="at_risk">At Risk</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
              <option value="terminated">Terminated</option>
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setFilters({ contractId: '', gov: '', status: '', startDate: '', endDate: '' })}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Compliance exceptions */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Compliance Exceptions</h2>
            <p className="mt-1 text-sm text-gray-600">
              Contracts requiring immediate review (schedule risk, expiring soon, or missing updates).
            </p>
          </div>
          <div className="space-y-3 p-6">
            {contracts
              .filter((c) => isExpiringSoon(c) || behindSchedule(c))
              .slice(0, 5)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-semibold">
                      {c.contract_number || c.service_requests?.tracking_id || c.id}
                    </p>
                    <p className="text-sm text-gray-600">{c.service_requests?.title || '—'}</p>
                  </div>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Review
                  </Link>
                </div>
              ))}
            {contracts.filter((c) => isExpiringSoon(c) || behindSchedule(c)).slice(0, 5).length === 0 && (
              <p className="text-gray-500">No exceptions detected.</p>
            )}
          </div>
        </section>

        {/* Contracts list (cards) */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Government Contracts</h2>
          </div>

          <div className="space-y-4 p-6">
            {filteredContracts.length === 0 ? (
              <p className="py-6 text-center text-gray-500">No contracts found.</p>
            ) : (
              filteredContracts.map((c) => {
                const endDate = parsePeriodEnd(c.period_of_performance);
                const daysLeft =
                  endDate != null
                    ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                const progress = c.progress_percentage ?? 0;

                return (
                  <div key={c.id} className="rounded-xl border px-6 py-5 transition hover:shadow-sm">
                    <div className="flex items-start justify-between gap-6">
                      {/* Left */}
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">
                          {c.contract_number || c.service_requests?.tracking_id || c.id}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Final Amount:{' '}
                          <span className="font-medium text-gray-900">
                            {c.final_amount != null ? `$${c.final_amount.toLocaleString()}` : '—'}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Admin Status: <span className="text-gray-800">{c.admin_status || '—'}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Last Updated:{' '}
                          <span className="text-gray-800">
                            {c.last_updated ? new Date(c.last_updated).toLocaleDateString() : '—'}
                          </span>
                        </p>

                        {/* Inline amount edit */}
                        <div className="mt-2">
                          {editingId === c.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editedAmount ?? c.final_amount ?? 0}
                                onChange={(e) => setEditedAmount(Number(e.target.value))}
                                className="w-32 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                              />
                              <button
                                onClick={() => updateContractAmount(c.id)}
                                disabled={saving}
                                className="text-sm font-semibold text-green-600"
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-sm text-gray-500">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(c.id);
                                setEditedAmount(c.final_amount ?? 0);
                              }}
                              className="inline-flex items-center gap-2 text-sm text-blue-600"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit Amount
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right (actions + progress) */}
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(c.status as string)}`}>
                          {c.status || 'unknown'}
                        </span>

                        <div className="mt-2 w-40">
                          <div className="h-2 w-full rounded-full bg-gray-200">
                            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="mt-1 text-right text-xs text-gray-600">{progress}% Complete</p>
                          {daysLeft !== null && daysLeft <= 60 && daysLeft >= 0 && (
                            <p className="mt-1 text-right text-xs text-red-600">
                              ⚠ Expiring in {daysLeft} day{daysLeft === 1 ? '' : 's'}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                         
                          <Link
                            href={`/contracts/${c.id}`}
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-900"
                          >
                            Manage
                          </Link>
                           {/*
                          {c.status !== 'active' && c.status !== 'closed' && c.status !== 'terminated' && (
                            <button
                              onClick={() => updateContractStatus(c.id, 'active')}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                            >
                              Mark Active
                            </button>
                          )}

                          {c.status !== 'at_risk' && c.status !== 'closed' && c.status !== 'terminated' && (
                            <button
                              onClick={() => updateContractStatus(c.id, 'at_risk')}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                            >
                              Mark At Risk
                            </button>
                          )}

                          {c.status !== 'completed' && c.status !== 'closed' && c.status !== 'terminated' && (
                            <button
                              onClick={() => updateContractStatus(c.id, 'completed')}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                            >
                              Mark Completed
                            </button>
                          )}

                          {c.status !== 'closed' && c.status !== 'terminated' && (
                            <button
                              onClick={() => updateContractStatus(c.id, 'closed')}
                              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-black"
                            >
                              Close
                            </button>
                          )}

                          {c.status !== 'terminated' && (
                            <button
                              onClick={() => updateContractStatus(c.id, 'terminated')}
                              className="rounded-lg bg-black px-3 py-1.5 text-xs text-white hover:bg-black/90"
                            >
                              Terminate
                            </button>
                          )} */}
                          
                          {/* Edit & Resubmit 
                          <Link
                            href={`/admin/contracts/${c.id}/edit`}
                            className="group inline-flex items-center rounded-2xl bg-blue-600 px-3 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-label="Edit and resubmit contract"
                            title="Edit"
                          >
                            <Pencil className="mr-2 h-4 w-4 opacity-90" />
                            <span className="leading-tight">
                              <span className="block font-semibold">Edit & Resubmit</span>
                            </span>
                          </Link>*/}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Recent service requests */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Your Recent Service Requests</h2>
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Request
            </Link>
          </div>

          <div className="space-y-3 p-6">
            {requests.slice(0, 25).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border px-6 py-3 transition hover:bg-gray-50">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-gray-500">Tracking ID:</span>
                    <span className="font-semibold text-gray-900">{r.tracking_id}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {r.gov_type} <span className="mx-2">•</span> {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {!r.awarded && (
                    <Link
                      href={`/requests/edit/${r.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit &amp; Resubmit
                    </Link>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      r.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : r.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- UI ---------- */
function KPI({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
``
