
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedPage from "@/components/auth/ProtectedPage";
import { createClient } from '@/lib/supabase/client'
import {
  Filter,
  Search,
  RefreshCcw,
  Download,
  UserMinus,
  Shield,
  ShieldOff,
  Loader2,
  Plus,
} from 'lucide-react';
import { getPermissions } from '@/lib/permissions/roles';

/* ===================== Types ===================== */

type Role =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'auditor'
  | 'client'
  | 'member'
  | 'viewer';

type MemberRow = {
  id: string;
  email: string;
  role: Role;
  org_id: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  updated_at: string | null;
};

type SortKey = 'name' | 'email' | 'role' | 'created_at' | 'updated_at';

/* ===================== Null-safe date utils ===================== */
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

/* ===================== Robust response parser ===================== */
async function parseJsonOrText(res: Response) {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text(); // read once
  if (ct.includes('application/json')) {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { nonJson: true, body: text };
    }
  }
  return { nonJson: true, body: text };
}

/* ===================== Helpers ===================== */

function fullName(m: Pick<MemberRow, 'first_name' | 'last_name'>) {
  const fn = (m.first_name || '').trim();
  const ln = (m.last_name || '').trim();
  const name = `${fn} ${ln}`.trim();
  return name || '';
}

function matchesSearch(m: MemberRow, q: string) {
  const name = fullName(m).toLowerCase();
  const email = (m.email || '').toLowerCase();
  return name.includes(q) || email.includes(q);
}

// small debounce helper
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ===================== Page ===================== */

export default function MembersPage() {
  return (
    <ProtectedPage permission="manageMembers">
      <MembersPageContent />
    </ProtectedPage>
  );
}
function MembersPageContent() {
  const supabase = createClient();
  const router = useRouter();

  // Role + caller identification
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const permissions = getPermissions(myRole);
  const canAdmin = permissions?.manageMembers;

  // Data + paging
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Filters / search / sort
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Show only active org members by default (org_id != null)
  const [showUnassigned, setShowUnassigned] = useState<boolean>(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null); // per-row spinner
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Realtime channel ref (optional)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Allowed roles to assign (adjust as needed)
  const ASSIGNABLE_ROLES: Role[] = [
    'viewer',
    'member',
    'client',
    'auditor',
    'manager',
    'admin',
    'owner',
  ];

  // Debounced loader for typing search
  const debouncedLoadRef = useRef<((reset?: boolean) => void) | null>(null);

  useEffect(() => {
    debouncedLoadRef.current = debounce((reset = false) => loadMembers(reset), 300);
  }, []);

  useEffect(() => {
  (async () => {
    try {

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        // Do nothing — proxy handles authentication
        setLoading(false);
        return;
      }

      const authUser = session.user;

        // Get caller's profile: id, role, org_id
        const { data: p, error } = await supabase
          .from('profiles')
          .select('id, role, org_id')
          .eq('id', authUser.id)
          .single();

console.log("PROFILE QUERY RESULT:", p);
console.log("PROFILE QUERY ERROR:", error);
console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log("SUPABASE KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

        const orgId = p?.org_id ?? null;

        setMyUserId(p?.id ?? authUser.id);
        setMyRole((p?.role ?? 'viewer') as Role);
        setMyOrgId(orgId);

        if (orgId) {
          await loadMembers(true, { orgId });
        }

        // Optional realtime: refresh on profile changes
        const channel = supabase
          .channel('members_realtime')
          .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => void loadMembers(false)
        )
          .subscribe();
        channelRef.current = channel;
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    // 1) Change signature
    async function loadMembers(
      reset = false,
      overrides?: Partial<{
        orgId: string | null
        showUnassigned: boolean
        roleFilter: Role | ''
        search: string
        page: number
        pageSize: number
      }>
    ) {
      setLoadingList(true)

      try {

        const orgId = overrides?.orgId ?? myOrgId
        const includeUnassigned = overrides?.showUnassigned ?? showUnassigned
        const effRoleFilter = overrides?.roleFilter ?? roleFilter
        const effSearch = overrides?.search ?? search
        const currentPage = overrides?.page ?? (reset ? 1 : page)
        const effPageSize = overrides?.pageSize ?? pageSize

        const from = (currentPage - 1) * effPageSize
        const to = from + effPageSize - 1

        console.log("Loading members for org:", orgId)

        let query = supabase
          .from('profiles')
          .select(
            'id,email,role,org_id,first_name,last_name,created_at,updated_at',
            { count: 'exact' }
          )

        // organization filter
        if (orgId) {
          if (includeUnassigned) {
            query = query.or(`org_id.eq.${orgId},org_id.is.null`)
          } else {
            query = query.eq('org_id', orgId)
          }
        }

        if (effRoleFilter) {
          query = query.eq('role', effRoleFilter)
        }

        if (effSearch.trim()) {
          query = query.ilike('email', `%${effSearch.trim()}%`)
        }

        query = query
          .order('created_at', { ascending: false })
          .range(from, to)

        const { data, error, count } = await query

        if (error) {
          console.error("Members query error:", error)
          setRows([])
          setTotal(0)
          return
        }

        setRows((data ?? []) as MemberRow[])
        setTotal(count ?? 0)

        if (reset) setPage(1)

      } finally {
        setLoadingList(false)
      }
    }



  /* ===================== Actions ===================== */

  function toggleSelectAll(checked: boolean, currentPageRows: MemberRow[]) {
    if (checked) {
      // Do not allow selecting yourself
      const ids = currentPageRows.filter(r => r.id !== myUserId).map((r) => r.id);
      setSelected((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      const ids = new Set(currentPageRows.map((r) => r.id));
      setSelected((prev) => prev.filter((id) => !ids.has(id)));
    }
  }

  function toggleRow(id: string, checked: boolean) {
    if (id === myUserId) return; // skip selecting yourself
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function changeRole(memberId: string, nextRole: Role) {
    setBusyId(memberId);
    try {
      if (!canAdmin) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (error) {
        alert(error.message || 'Failed to change role');
      } else {
        await loadMembers(true); // reset paging + re-query
      }
    } finally {
      setBusyId(null);
    }
  }

  // Single remove
  async function removeMember(memberId: string) {
    if (!confirm('Remove this member from the organization?')) return;
    setBusyId(memberId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch('/api/members/remove', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId }),
      });

      const payload = await parseJsonOrText(res);
      if (!res.ok) {
        const msg = (payload as any)?.error || (payload as any)?.body || `Remove failed (${res.status})`;
        alert(msg);
        return;
      }
      await loadMembers(true); // reset paging + re-query
    } finally {
      setBusyId(null);
    }
  }

  // Bulk remove (parallelized; skips self; shows aggregated errors)
  async function bulkRemove() {
    if (!selected.length) return;

    const targets = selected.filter((id) => id !== myUserId);
    if (!targets.length) {
      alert('You cannot remove yourself.');
      return;
    }

    if (!confirm(`Remove ${targets.length} selected member(s)?`)) return;

    setBulkBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const results = await Promise.allSettled(
        targets.map(async (memberId) => {
          const res = await fetch('/api/members/remove', {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ memberId }),
          });

          if (!res.ok) {
            const txt = await res.text();
            try {
              const j = txt ? JSON.parse(txt) : {};
              throw new Error(j.error || `Remove failed for ${memberId} (${res.status})`);
            } catch {
              throw new Error(txt || `Remove failed for ${memberId} (${res.status})`);
            }
          }
          return memberId;
        })
      );

      const failures = results
        .map((r) => (r.status === 'rejected' ? (r.reason?.message as string) : null))
        .filter(Boolean) as string[];

      if (failures.length) {
        alert(`Some removals failed:\n\n${failures.join('\n')}`);
      } else {
        // optional toast: all removed
      }

      setSelected([]);
      await loadMembers(true); // reset paging + re-query
    } finally {
      setBulkBusy(false);
    }
  }

  function exportCSV() {
    const headers = ['Name', 'Email', 'Role', 'Created', 'Updated'];
    const lines = rows.map((r) => [
      fullName(r) || '—',
      r.email,
      r.role,
      formatDateSafe(r.created_at),
      formatDateSafe(r.updated_at),
    ]);
    const csv =
      headers.join(',') +
      '\n' +
      lines.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ===================== Sorting ===================== */
  function onSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir(col === 'created_at' ? 'desc' : 'asc');
    }
    void loadMembers(false);
  }

  const start = (page - 1) * pageSize;
  const currentPageRows = rows;

  /* ===================== Render ===================== */

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Organization Members</h1>
            <p className="text-xs text-gray-500">Manage roles and remove members. RLS enforced.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadMembers(true)}
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
            <a
              href="/admin/invitations"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Invite Members
            </a>
          </div>
        </div>
      </header>

      {/* Filters */}
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </span>

            {/* Active-only toggle */}
            <label className="inline-flex items-center gap-2 text-xs font-normal text-gray-600">
              <input
                type="checkbox"
                checked={showUnassigned}
                onChange={(e) => {
                  setShowUnassigned(e.target.checked);
                  setPage(1);
                  loadMembers(true);
                }}
              />
              Show unassigned (org_id = null)
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-gray-200 bg-white px-3 text-sm">
              <Search className="mr-2 h-4 w-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  // Use debounced requery as user types; or remove and rely on "Apply"
                  debouncedLoadRef.current?.(true);
                }}
                placeholder="Search name or email…"
                className="w-full bg-transparent outline-none"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as Role | '');
                setPage(1);
                loadMembers(true);
              }}
              className="h-9 rounded-lg border px-3 text-sm"
            >
              <option value="">All roles</option>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
                loadMembers(true);
              }}
              className="h-9 rounded-lg border px-3 text-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <div className="flex items-center">
              <button
                onClick={() => loadMembers(true)}
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
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={currentPageRows.length > 0 && currentPageRows.every((r) => r.id === myUserId || selected.includes(r.id))}
                      onChange={(e) => toggleSelectAll(e.currentTarget.checked, currentPageRows)}
                      aria-label="Select all on page"
                    />
                  </Th>
                  <SortableTh label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                  <SortableTh label="Email" active={sortKey === 'email'} dir={sortDir} onClick={() => onSort('email')} />
                  <SortableTh label="Role" active={sortKey === 'role'} dir={sortDir} onClick={() => onSort('role')} />
                  <SortableTh
                    label="Created"
                    active={sortKey === 'created_at'}
                    dir={sortDir}
                    onClick={() => onSort('created_at')}
                  />
                  <SortableTh
                    label="Updated"
                    active={sortKey === 'updated_at'}
                    dir={sortDir}
                    onClick={() => onSort('updated_at')}
                  />
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {loadingList ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading...
                    </td>
                  </tr>
                ) : currentPageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No members found.
                    </td>
                  </tr>
                ) : (
                  currentPageRows.map((r) => {
                    const isSelf = r.id === myUserId;
                    const outOfOrg = !!myOrgId && !!r.org_id && myOrgId !== r.org_id; // hint only; server still enforces
                    const disabledRm = !canAdmin || busyId === r.id || isSelf /* || outOfOrg */;

                    return (
                      <tr key={r.id} className="bg-white">
                        <Td className="w-10">
                          <input
                            type="checkbox"
                            checked={selected.includes(r.id)}
                            onChange={(e) => toggleRow(r.id, e.currentTarget.checked)}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot select yourself' : undefined}
                            aria-label={`Select ${fullName(r) || r.email}`}
                          />
                        </Td>

                        <Td className="max-w-[260px] truncate">{fullName(r) || '—'}</Td>
                        <Td className="max-w-[320px] truncate">{r.email}</Td>

                        <Td>
                          <span className="inline-flex items-center gap-2">
                            {(r.role === 'owner' || r.role === 'admin' || r.role === 'manager') ? (
                              <Shield className="h-3.5 w-3.5 text-blue-600" />
                            ) : (
                              <ShieldOff className="h-3.5 w-3.5 text-gray-400" />
                            )}
                            {canAdmin ? (
                              <select
                                disabled={busyId === r.id}
                                value={r.role}
                                onChange={(e) => changeRole(r.id, e.target.value as Role)}
                                className="rounded-md border px-2 py-1 text-xs"
                              >
                                {ASSIGNABLE_ROLES.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{r.role}</span>
                            )}
                          </span>
                        </Td>

                        <Td>{formatDateSafe(r.created_at)}</Td>
                        <Td>{formatDateSafe(r.updated_at)}</Td>

                        <Td align="right">
                          <button
                            disabled={disabledRm}
                            title={
                              isSelf
                                ? 'You cannot remove yourself'
                                : /* outOfOrg ? 'Member is in a different organization' : */ undefined
                            }
                            onClick={() => removeMember(r.id)}
                            className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                          >
                            {busyId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bulk bar */}
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-gray-600">
              {selected.length ? `${selected.length} selected` : 'Select rows to enable bulk actions'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkRemove}
                disabled={!selected.length || bulkBusy || !canAdmin}
                className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                Remove Selected
              </button>

              {/* Paging controls */}
              <div className="ml-2 flex items-center gap-1">
                <button
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    void loadMembers(false);
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
                    void loadMembers(false);
                  }}
                  disabled={page >= totalPages}
                  className="rounded-md border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ===================== Small components ===================== */

function Th({ children, className = '' }: any) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}
function Td({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td className={`px-4 py-3 align-middle text-gray-800 ${className}`} style={{ textAlign: align }}>
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
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <Th>
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:underline">
        {label}
        <span className="inline-block">{active ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
      </button>
    </Th>
  );
}

/* ===================== Tiny CSV util ===================== */
function csvEscape(v: any) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
``
