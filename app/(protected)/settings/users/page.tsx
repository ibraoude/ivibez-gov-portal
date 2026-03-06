
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { User as UserIcon, Shield, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

/* ==================== Types (EXACTLY your table) ==================== */

type Profile = {
  id: string;                    // uuid
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  company: string | null;
  created_at: string | null;     // timestamptz
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
  state_region: string | null;
  email: string | null;
  org_id: string;                // uuid
  updated_at: string | null;     // timestamptz
};

// For the list/table; still a subset is fine for lightweight table reads.
// (We’ll still fetch full profile on selection to keep it fresh)
type OrgUserLite = Pick<
  Profile,
  'id' | 'first_name' | 'last_name' | 'email' | 'role' | 'org_id'
>;

type PasswordForm = { password: string; confirm: string };

/* ==================== Page ==================== */

export default function UsersDirectoryPage() {
  // Auth & current user context
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  // Users list (admin: all in org; non-admin: just self)
  const [usersInOrg, setUsersInOrg] = useState<OrgUserLite[]>([]);
  const [search, setSearch] = useState('');

  // Selection
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Data for the details panel (full profile)
  const [profile, setProfile] = useState<Profile>({
    id: '',
    first_name: null,
    last_name: null,
    phone: null,
    role: null,
    company: null,
    created_at: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    country_code: null,
    state_region: null,
    email: null,
    org_id: '' as string,
    updated_at: null,
  });

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [password, setPassword] = useState<PasswordForm>({ password: '', confirm: '' });

  // Derived permissions
  const canActAsAdmin = useMemo(
    () => ['admin', 'super_admin'].includes((currentUserProfile?.role ?? '').toString()),
    [currentUserProfile?.role]
  );
  const isViewingAnotherUser = useMemo(
    () => !!currentUserId && !!selectedUserId && currentUserId !== selectedUserId,
    [currentUserId, selectedUserId]
  );
  // Protected fields (role, email, company): editable ONLY when admin/super_admin edits someone else
  const lockProtected = !(canActAsAdmin && isViewingAnotherUser);

  /* ---------- Boot: load current user + profile; then load table ---------- */
  useEffect(() => {
    async function boot() {
      setLoading(true);
      setMessage(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;

      if (authErr || !user) {
        setMessage({ type: 'error', text: 'You must be signed in.' });
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: me, error: meErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (meErr) {
        setMessage({ type: 'error', text: meErr.message });
        setLoading(false);
        return;
      }

      if (!me) {
        setMessage({ type: 'error', text: 'No profile row found.' });
        setLoading(false);
        return;
      }

      setCurrentUserProfile(me);

      // Load table rows
      if (['admin', 'super_admin'].includes(me.role ?? '')) {
        const { data: orgUsers, error: orgErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, org_id')
          .eq('org_id', me.org_id)
          .order('first_name', { ascending: true });

        if (orgErr) {
          setMessage({ type: 'error', text: orgErr.message });
        }
        if (orgUsers) {
          setUsersInOrg(orgUsers);
        }
      } else {
        // Non-admin: table only shows yourself
        setUsersInOrg([
          {
            id: me.id,
            first_name: me.first_name,
            last_name: me.last_name,
            email: me.email,
            role: me.role,
            org_id: me.org_id,
          },
        ]);
      }

      // Preselect yourself on first load
      setSelectedUserId(user.id);

      setLoading(false);
    }

    boot();
  }, []);

  /* ---------- Load selected user full profile whenever selection changes ---------- */
  useEffect(() => {
    async function loadSelected() {
      if (!selectedUserId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', selectedUserId)
        .maybeSingle();

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
      if (data) setProfile(data);
    }
    loadSelected();
  }, [selectedUserId]);

  /* ---------- Save Profile (ONLY table columns; protected gated) ---------- */
  async function saveProfile() {
    if (!currentUserId || !selectedUserId) return;

    setSaving(true);
    setMessage(null);

    const payload: Partial<Profile> = {
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone,
      address_line1: profile.address_line1,
      address_line2: profile.address_line2,
      city: profile.city,
      state: profile.state,
      postal_code: profile.postal_code,
      country: profile.country,
      country_code: profile.country_code,
      state_region: profile.state_region,
      updated_at: new Date().toISOString(),
    };

    // Only admins editing someone else can update role/email/company
    if (!lockProtected) {
      payload.role = profile.role;
      payload.email = profile.email;
      payload.company = profile.company;
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', selectedUserId);
    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
      return;
    }

    setMessage({ type: 'success', text: 'Profile updated successfully.' });

    // Update current user's in-memory profile if applicable
    if (selectedUserId === currentUserId) {
      setCurrentUserProfile((prev) => (prev ? ({ ...prev, ...payload } as Profile) : prev));
    }

    // Also reflect changed values in the table’s row for consistency (name/email/role)
    setUsersInOrg((rows) =>
      rows.map((u) =>
        u.id === selectedUserId
          ? {
              ...u,
              first_name: payload.first_name ?? u.first_name,
              last_name: payload.last_name ?? u.last_name,
              email: (payload.email as string) ?? u.email,
              role: (payload.role as string) ?? u.role,
            }
          : u
      )
    );
  }

  /* ---------- Password (self only) ---------- */
  async function handlePasswordChange() {
    if (isViewingAnotherUser) {
      setMessage({
        type: 'error',
        text: 'Admins cannot change other users’ passwords from the client.',
      });
      return;
    }
    if (password.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (password.password !== password.confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: password.password });
    setPwdSaving(false);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Could not update password.' });
      return;
    }
    setPassword({ password: '', confirm: '' });
    setMessage({ type: 'success', text: 'Password updated successfully.' });
  }

  /* ---------- Derived: filtered rows ---------- */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return usersInOrg;
    return usersInOrg.filter((u) => {
      const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.role ?? '').toLowerCase().includes(q)
      );
    });
  }, [usersInOrg, search]);

  if (loading) return <div className="p-10 text-gray-500">Loading users…</div>;

  if (!currentUserId) {
    return (
      <div className="p-10">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-gray-700">Please sign in to view your users.</div>
          <div className="mt-4">
            <Link href="/login" className="text-blue-600 hover:underline">
              Go to sign in →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-gray-500">
            {canActAsAdmin ? 'Browse and manage users in your organization.' : 'Your account details.'}
          </p>
        </div>
      </div>

      {/* GLOBAL MESSAGE */}
      {message && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 mt-0.5" />
          )}
          <div>{message.text}</div>
        </div>
      )}

      {/* LAYOUT: TABLE (left) + DETAILS (right) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT: Users table */}
        <section className="lg:col-span-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Users</div>
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm"
                placeholder="Search name, email, role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredRows.map((u) => {
                  const isActive = u.id === selectedUserId;
                  const fullName = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—';
                  return (
                    <tr
                      key={u.id}
                      className={`${isActive ? 'bg-blue-50/60' : 'hover:bg-gray-50 cursor-pointer'}`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <td className="px-4 py-2 text-sm text-gray-900">{fullName}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{u.email ?? '—'}</td>
                      <td className="px-4 py-2 text-xs">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 font-medium ${
                            (u.role ?? '') === 'super_admin'
                              ? 'bg-purple-50 text-purple-700'
                              : (u.role ?? '') === 'admin'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.role ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!canActAsAdmin && (
            <p className="mt-3 text-xs text-gray-500">
              You don’t have admin permissions. Only your own account is visible.
            </p>
          )}
        </section>

        {/* RIGHT: Details / edit */}
        <section className="lg:col-span-7 space-y-6">
          <SectionCard
            icon={<UserIcon className="h-5 w-5" />}
            title="Profile"
            description={
              isViewingAnotherUser && canActAsAdmin
                ? 'Editing selected user profile.'
                : 'Manage your profile information.'
            }
            footer={
              <div className="flex items-center gap-2">
                <button
                  onClick={saveProfile}
                  disabled={saving || !selectedUserId}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                {lockProtected && (
                  <span className="text-xs text-gray-500">
                    Role, Email, and Company are restricted for your own profile.
                  </span>
                )}
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name" value={profile.first_name ?? ''} onChange={(v) => setProfile({ ...profile, first_name: v })} />
              <Field label="Last name"  value={profile.last_name  ?? ''} onChange={(v) => setProfile({ ...profile, last_name: v  })} />
              <Field label="Phone"       value={profile.phone       ?? ''} onChange={(v) => setProfile({ ...profile, phone: v       })} placeholder="+1 (555) 123‑4567" />

              {/* Protected (gated) */}
              <Field
                label="Role"
                value={profile.role ?? ''}
                readOnly={lockProtected}
                onChange={!lockProtected ? (v) => setProfile({ ...profile, role: v }) : undefined}
              />
              <Field
                label="Company"
                value={profile.company ?? ''}
                readOnly={lockProtected}
                onChange={!lockProtected ? (v) => setProfile({ ...profile, company: v }) : undefined}
              />
              <Field
                label="Email"
                value={profile.email ?? ''}
                readOnly={lockProtected}
                onChange={!lockProtected ? (v) => setProfile({ ...profile, email: v }) : undefined}
              />

              {/* Address (all non-protected) */}
              <Field label="Address line 1" value={profile.address_line1 ?? ''} onChange={(v) => setProfile({ ...profile, address_line1: v })} />
              <Field label="Address line 2" value={profile.address_line2 ?? ''} onChange={(v) => setProfile({ ...profile, address_line2: v })} />
              <Field label="City"          value={profile.city          ?? ''} onChange={(v) => setProfile({ ...profile, city: v })} />
              <Field label="State / Province" value={profile.state ?? ''} onChange={(v) => setProfile({ ...profile, state: v })} />
              <Field label="Postal code"      value={profile.postal_code ?? ''} onChange={(v) => setProfile({ ...profile, postal_code: v })} />
              <Field label="Country"          value={profile.country ?? ''} onChange={(v) => setProfile({ ...profile, country: v })} />
              <Field label="Country code"     value={profile.country_code ?? ''} onChange={(v) => setProfile({ ...profile, country_code: v })} />
              <Field label="State region"     value={profile.state_region ?? ''} onChange={(v) => setProfile({ ...profile, state_region: v })} />
            </div>
          </SectionCard>

          <SectionCard
            icon={<Shield className="h-5 w-5" />}
            title="Security"
            description={isViewingAnotherUser ? 'Password changes are self‑service only.' : 'Change your password.'}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <PasswordField
                label="New password"
                value={password.password}
                onChange={(v) => setPassword((p) => ({ ...p, password: v }))}
                placeholder="••••••••"
              />
              <PasswordField
                label="Confirm password"
                value={password.confirm}
                onChange={(v) => setPassword((p) => ({ ...p, confirm: v }))}
                placeholder="••••••••"
              />
              <div className="flex items-end">
                <button
                  onClick={handlePasswordChange}
                  disabled={pwdSaving || isViewingAnotherUser}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white shadow hover:bg-indigo-700 disabled:opacity-60"
                >
                  {pwdSaving ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </div>
          </SectionCard>
        </section>
      </div>
    </div>
  );
}

/* ==================== Reusable Components ==================== */

function SectionCard({
  icon,
  title,
  description,
  footer,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        {icon && <div className="text-gray-600">{icon}</div>}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-6 space-y-4">{children}</div>
      {footer && <div className="mt-6 border-t pt-4">{footer}</div>}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          readOnly ? 'bg-gray-50 text-gray-500' : ''
        }`}
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
          aria-label="Toggle password visibility"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );
}
``
