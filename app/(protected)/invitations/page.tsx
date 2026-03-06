
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Filter,
  Search,
  Plus,
  Send,
  XCircle,
  RefreshCcw,
  Download,
} from 'lucide-react';

type Role = 'owner' | 'admin' | 'manager' | 'auditor' | 'client' | 'member' | 'viewer';

type Invitation = {
  id: string;
  org_id: string;
  email: string;
  role: string;
  token?: string | null;
  invited_by: string;
  created_at: string;
  expires_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
  inviter?: { email?: string } | null; // mapped from profiles
};

type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* -------------------- date utils (null-safe) -------------------- */
function toDateSafe(v: string | number | Date | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDateSafe(
  v: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = toDateSafe(v);
  return d ? d.toLocaleString(undefined, options) : '—';
}

/* -------------------- parse helper (robust) -------------------- */
async function parseJsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text(); // always read once
  if (ct.includes('application/json')) {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { nonJson: true, body: text };
    }
  }
  return { nonJson: true, body: text };
}

/* -------------------- status compute -------------------- */
function computeStatus(inv: Invitation): InviteStatus {
  if (inv.revoked_at) return 'revoked';
  if (inv.accepted_at) return 'accepted';
  const exp = toDateSafe(inv.expires_at);
  if (exp && exp.getTime() < Date.now()) return 'expired';
  return 'pending';
}

/* -------------------- tag styles -------------------- */
const statusStyles: Record<InviteStatus, string> = {
  pending:
    'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  accepted:
    'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  revoked:
    'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20',
  expired:
    'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10',
};

export default function InvitationManagementPage() {
  const router = useRouter();

  // role
  const [role, setRole] = useState<Role | null>(null);
  const canAdmin = role === 'owner' || role === 'admin' || role === 'manager';

  // data + paging
  const [rows, setRows] = useState<Invitation[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | InviteStatus>('');

  // ui state
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AllowedRole>('viewer');
  const [targetOrg, setTargetOrg] = useState<string>(''); // optional for platform admins

  type AllowedRole = Extract<Role, 'owner' | 'admin' | 'manager' | 'auditor' | 'client' | 'member' | 'viewer'>;

  useEffect(() => {
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          router.push('/login');
          return;
        }
        // RLS-safe: lookup own role
        const { data: p } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        setRole((p?.role ?? 'viewer') as Role);
        await fetchInvitations(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchInvitations(reset = false) {
    setLoadingList(true);
    try {
      const currentPage = reset ? 1 : page;
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('invitations')
        .select('id, org_id, email, role, token, invited_by, created_at, expires_at, accepted_at, revoked_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, to);

      // filter by status
      if (statusFilter) {
        if (statusFilter === 'pending') {
          query = query.is('accepted_at', null).is('revoked_at', null);
        } else if (statusFilter === 'accepted') {
          query = query.not('accepted_at', 'is', null);
        } else if (statusFilter === 'revoked') {
          query = query.not('revoked_at', 'is', null);
        } else if (statusFilter === 'expired') {
          // We can only compute expired client-side unless you add a generated column;
          // leave as general fetch; we’ll compute status below
        }
      }

      // search by email
      if (search.trim()) {
        const term = search.trim().replace(/[%_]/g, (m) => '\\' + m);
        query = query.ilike('email', `%${term}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('invitations fetch error:', error.message);
        setRows([]);
        setTotal(0);
      } else {
        const list = (data ?? []) as Invitation[];

        // Map inviter emails
        const inviterIds = Array.from(new Set(list.map((r) => r.invited_by).filter(Boolean))) as string[];
        let inviterEmailById: Record<string, string> = {};
        if (inviterIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', inviterIds);
          inviterEmailById =
            Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email])) ?? {};
        }

        const normalized = list.map((r) => ({
          ...r,
          inviter: r.invited_by ? { email: inviterEmailById[r.invited_by] } : null,
        }));

        // If filtering expired: compute and filter here
        const filtered =
          statusFilter === 'expired'
            ? normalized.filter((r) => computeStatus(r) === 'expired')
            : normalized;

        setRows(filtered);
        setTotal(statusFilter === 'expired' ? filtered.length : count ?? 0);
        if (reset) setPage(1);
      }
    } finally {
      setLoadingList(false);
    }
  }

  // Actions
  async function handleCreate() {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole,
          org_id: targetOrg || undefined, // only used for platform admins
        }),
      });

      const payload = await parseJsonOrText(res);
      if (!res.ok) {
        const msg = (payload as any)?.error || (payload as any)?.body || `Create failed (${res.status})`;
        alert(msg);
        return;
      }
      setModalOpen(false);
      setNewEmail('');
      setNewRole('viewer');
      setTargetOrg('');
      await fetchInvitations(true);
    } finally {
      setCreating(false);
    }
  }

  async function handleResend(id: string) {
    setResendingId(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(`/api/invitations/${id}/resend`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      const payload = await parseJsonOrText(res);
      if (!res.ok) {
        const msg = (payload as any)?.error || (payload as any)?.body || `Resend failed (${res.status})`;
        alert(msg);
        return;
      }
      await fetchInvitations(false);
    } finally {
      setResendingId(null);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(`/api/invitations/${id}/revoke`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      const payload = await parseJsonOrText(res);
      if (!res.ok) {
        const msg = (payload as any)?.error || (payload as any)?.body || `Revoke failed (${res.status})`;
        alert(msg);
        return;
      }
      await fetchInvitations(false);
    } finally {
      setRevokingId(null);
    }
  }

  function exportCSV() {
    const headers = [
      'Email',
      'Role',
      'Status',
      'Invited By',
      'Created',
      'Expires',
      'Accepted',
      'Revoked',
    ];
    const lines = rows.map((r) => [
      r.email,
      r.role,
      computeStatus(r),
      r.inviter?.email ?? '',
      formatDateSafe(r.created_at),
      formatDateSafe(r.expires_at),
      formatDateSafe(r.accepted_at),
      formatDateSafe(r.revoked_at),
    ]);
    const csv =
      headers.join(',') +
      '\n' +
      lines.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitations_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Derived
  const canResend = (r: Invitation) => {
    const s = computeStatus(r);
    return s === 'pending' || s === 'expired';
  };
  const canRevoke = (r: Invitation) => {
    const s = computeStatus(r);
    return s === 'pending' || s === 'expired';
  };

  /* -------------------- render -------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Invitation Management</h1>
            <p className="text-xs text-gray-500">
              Create, resend, revoke invitations. RLS‑safe & org‑scoped.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInvitations(true)}
              disabled={loadingList}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {canAdmin && (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Invitation
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Filters */}
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-gray-200 bg-white px-3 text-sm">
              <Search className="mr-2 h-4 w-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email…"
                className="w-full bg-transparent outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InviteStatus | '')}
              className="h-9 rounded-lg border px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 rounded-lg border px-3 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <div className="flex items-center">
              <button
                onClick={() => fetchInvitations(true)}
                className="h-9 w-full rounded-lg border px-3 text-sm hover:bg-gray-50"
              >
                Apply
              </button>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Invited By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Expires</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading || loadingList ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No invitations found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const st = computeStatus(r);
                    return (
                      <tr key={r.id} className="bg-white">
                        <td className="px-4 py-3">{r.email}</td>
                        <td className="px-4 py-3">{r.role}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[st]}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3">{r.inviter?.email ?? '—'}</td>
                        <td className="px-4 py-3">{formatDateSafe(r.created_at)}</td>
                        <td className="px-4 py-3">{formatDateSafe(r.expires_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              disabled={!canAdmin || !canResend(r) || resendingId === r.id}
                              onClick={() => handleResend(r.id)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              {resendingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Resend
                            </button>
                            <button
                              disabled={!canAdmin || !canRevoke(r) || revokingId === r.id}
                              onClick={() => handleRevoke(r.id)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              {revokingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-gray-600">
              {total
                ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`
                : '—'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  void fetchInvitations(false);
                }}
                disabled={page <= 1}
                className="rounded-md border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-2">{page} / {totalPages}</span>
              <button
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  void fetchInvitations(false);
                }}
                disabled={page >= totalPages}
                className="rounded-md border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold">Create Invitation</h3>
            <div className="space-y-3">
              <div className="text-sm">
                <label className="mb-1 block text-gray-600">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="user@example.com"
                />
              </div>
              <div className="text-sm">
                <label className="mb-1 block text-gray-600">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AllowedRole)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {['viewer', 'member', 'manager', 'admin', 'owner', 'auditor', 'client'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional org box for platform admins; harmless otherwise */}
              <div className="text-sm">
                <label className="mb-1 block text-gray-600">Target Org (platform admin only)</label>
                <input
                  type="text"
                  value={targetOrg}
                  onChange={(e) => setTargetOrg(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="org UUID (optional)"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- tiny csv utils -------------------- */
function csvEscape(v: any) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
