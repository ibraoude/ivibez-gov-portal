
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  Building2,
  Image as ImageIcon,
  Upload,
  Globe2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Plus,
  Copy,
  Send,
  Search,
} from 'lucide-react';

/* ==================== Helpers ==================== */

// Build invite URL like https://your-app.com/signup?org_id=...
function buildInviteUrl(orgId: string) {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://your-app.example.com'; // fallback for SSR

  const url = new URL('/signup', origin);
  url.searchParams.set('org_id', orgId);
  return url.toString();
}

/* ==================== Types (EXACTLY your tables) ==================== */

type Organization = {
  id: string; // uuid
  name: string;
  created_at: string | null; // timestamptz
  created_by: string; // uuid
  agency_type: string | null;
  gov_domain: string | null;
  // normalized_name is generated; do not send from client
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  allow_self_registration: boolean | null;
  require_admin_approval: boolean | null;
  updated_at: string | null; // timestamptz
};

type ProfileLite = {
  id: string;
  org_id: string;
  role: string | null;
};

// Global admin membership row
type AdminUser = { user_id: string };

/* ==================== Page ==================== */

export default function OrganizationsDirectoryPage() {
  // Auth / profile
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  // Global admin flag (from admin_users table)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState<boolean>(false);

  // Organizations list (left table)
  const [orgList, setOrgList] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');

  // Selection & creation modes for details panel (right)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  // Loaded organization details + editable draft
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [draft, setDraft] = useState<Organization | null>(null);

  // Create form
  const [newOrg, setNewOrg] = useState<
    Pick<
      Organization,
      | 'name'
      | 'legal_name'
      | 'email'
      | 'phone'
      | 'website'
      | 'agency_type'
      | 'gov_domain'
      | 'address_line1'
      | 'address_line2'
      | 'city'
      | 'state'
      | 'postal_code'
      | 'country'
    >
  >({
    name: '',
    legal_name: '',
    email: '',
    phone: '',
    website: '',
    agency_type: '',
    gov_domain: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });

  // Invite
  const [inviteEmail, setInviteEmail] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Refs for Google Places (create form + edit form)
  const createAddressRef = useRef<HTMLInputElement | null>(null);
  const editAddressRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Permissions
  // - global admin can edit any org
  // - org admins/super_admins can edit their own org
  const canEdit = useMemo(() => {
    if (!profile) return false;
    if (isGlobalAdmin) return true;
    const isOrgAdmin = ['admin', 'super_admin'].includes((profile.role ?? '').toString());
    return isOrgAdmin && !!organization && organization.id === profile.org_id;
  }, [profile, isGlobalAdmin, organization?.id]);

  /* ==================== Data loading ==================== */

  async function loadAllOrgsForGlobalAdmin() {
    const { data, error } = await supabase.from('organizations').select('*').order('name', { ascending: true });
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setOrgList((data ?? []) as Organization[]);
  }

  async function loadSingleOrg(orgId: string) {
    const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle();
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to load organization.' });
      return;
    }
    if (data) {
      setOrganization(data as Organization);
      setDraft(data as Organization);
    } else {
      setOrganization(null);
      setDraft(null);
    }
  }

  // Boot: auth → admin_users → profile → org list
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage(null);
      try {
        // Auth
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) {
          setMessage({ type: 'error', text: 'You must be signed in to view organizations.' });
          setLoading(false);
          return;
        }
        setCurrentUserId(user.id);

        // Global admin check
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle<AdminUser>();
        setIsGlobalAdmin(!!adminRow);

        // Profile (org & role)
        const { data: p, error: pErr } = await supabase
          .from('profiles')
          .select('id, org_id, role')
          .eq('id', user.id)
          .maybeSingle();

        if (pErr || !p) {
          setMessage({ type: 'error', text: 'Could not load your profile.' });
          setLoading(false);
          return;
        }
        setProfile(p as ProfileLite);

        // Org list
        if (!!adminRow) {
          await loadAllOrgsForGlobalAdmin();
        } else {
          // non-global: only own org in the table
          const { data: ownOrg, error: orgErr } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', (p as ProfileLite).org_id)
            .maybeSingle();

          if (orgErr) setMessage({ type: 'error', text: orgErr.message });
          setOrgList(ownOrg ? [ownOrg as Organization] : []);
        }

        // NOTE: details panel is empty until user clicks a row (as requested)
        // selectedOrgId remains null

      } catch (e) {
        console.error(e);
        setMessage({ type: 'error', text: 'Unexpected error loading organizations.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load details on selection
  useEffect(() => {
    if (!selectedOrgId) {
      setOrganization(null);
      setDraft(null);
      return;
    }
    loadSingleOrg(selectedOrgId);
  }, [selectedOrgId]);

  /* ==================== Google Places Autocomplete ==================== */
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
      return;
    }

    const cleanups: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      try {
        setOptions({ key, v: 'weekly' });
        const placesLib = await importLibrary('places' as any);
        const { Autocomplete } = placesLib as any;

        const read = (type: string, comps: any[], short = false) => {
          const f = comps.find((c: any) => c.types.includes(type));
          return f ? (short ? f.short_name : f.long_name) : '';
        };

        const bind = (
          el: HTMLInputElement,
          apply: (parts: {
            address_line1: string;
            city: string;
            state: string;
            postal_code: string;
            country: string;
          }) => void
        ) => {
          const ac = new Autocomplete(el, {
            fields: ['address_components'],
            types: ['address'],
            // componentRestrictions: { country: ['us'] }, // optional
          });

          const listener = ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            const comps: any[] = place?.address_components || [];
            const streetNumber = read('street_number', comps);
            const route = read('route', comps);

            apply({
              address_line1: `${streetNumber} ${route}`.trim(),
              city: read('locality', comps) || read('postal_town', comps),
              state: read('administrative_area_level_1', comps, true),
              postal_code: read('postal_code', comps),
              country: read('country', comps, true), // ISO
            });
          });

          return () => {
            try {
              listener.remove();
            } catch {}
          };
        };

        if (cancelled) return;

        // CREATE
        if (
          createAddressRef.current &&
          !createAddressRef.current.readOnly &&
          !createAddressRef.current.disabled
        ) {
          cleanups.push(
            bind(createAddressRef.current, (parts) => setNewOrg((p) => ({ ...p, ...parts })))
          );
        }

        // EDIT
        if (
          editAddressRef.current &&
          !editAddressRef.current.readOnly &&
          !editAddressRef.current.disabled
        ) {
          cleanups.push(
            bind(editAddressRef.current, (parts) =>
              setDraft((p) => (p ? ({ ...p, ...parts } as Organization) : p))
            )
          );
        }
      } catch (err) {
        console.error('Google Places init failed', err);
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
    // Keep deps minimal; .current values allow rebind when inputs mount
  }, [createAddressRef.current, editAddressRef.current]);

  /* ==================== Actions ==================== */

  // Save (update)
  async function saveOrganization() {
    if (!organization || !draft) return;
    if (!canEdit) {
      setMessage({ type: 'error', text: 'You do not have permission to update this organization.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload: Partial<Organization> = {
      name: draft.name,
      agency_type: draft.agency_type,
      gov_domain: draft.gov_domain,
      legal_name: draft.legal_name,
      email: draft.email,
      phone: draft.phone,
      website: draft.website,
      logo_url: draft.logo_url,
      address_line1: draft.address_line1,
      address_line2: draft.address_line2,
      city: draft.city,
      state: draft.state,
      postal_code: draft.postal_code,
      country: draft.country,
      allow_self_registration: draft.allow_self_registration ?? false,
      require_admin_approval: draft.require_admin_approval ?? true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('organizations').update(payload).eq('id', organization.id);
    setSaving(false);

    if (error) {
      console.error('org update error', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save organization.' });
      return;
    }

    setOrganization({ ...organization, ...payload });
    setDraft((d) => (d ? ({ ...d, ...payload } as Organization) : d));
    setMessage({ type: 'success', text: 'Organization updated successfully.' });

    // reflect updated values in table
    setOrgList((rows) =>
      rows.map((o) => (o.id === organization.id ? ({ ...o, ...payload } as Organization) : o))
    );
  }

  // Create
  async function createOrganization() {
    if (!isGlobalAdmin || !currentUserId) {
      setMessage({ type: 'error', text: 'Only global admins can create organizations.' });
      return;
    }
    if (!newOrg.name.trim()) {
      setMessage({ type: 'error', text: 'Organization name is required.' });
      return;
    }

    const payload: Partial<Organization> = {
      name: newOrg.name.trim(),
      legal_name: (newOrg.legal_name ?? '').trim() || null,
      email: (newOrg.email ?? '').trim() || null,
      phone: (newOrg.phone ?? '').trim() || null,
      website: (newOrg.website ?? '').trim() || null,
      agency_type: (newOrg.agency_type ?? '').trim() || null,
      gov_domain: (newOrg.gov_domain ?? '').trim() || null,
      address_line1: (newOrg.address_line1 ?? '').trim() || null,
      address_line2: (newOrg.address_line2 ?? '').trim() || null,
      city: (newOrg.city ?? '').trim() || null,
      state: (newOrg.state ?? '').trim() || null,
      postal_code: (newOrg.postal_code ?? '').trim() || null,
      country: (newOrg.country ?? '').trim() || null,
      allow_self_registration: false,
      require_admin_approval: true,
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('organizations').insert(payload).select('*').single();
    if (error || !data) {
      setMessage({ type: 'error', text: error?.message || 'Failed to create organization.' });
      return;
    }

    // refresh table + reset form
    if (isGlobalAdmin) {
      await loadAllOrgsForGlobalAdmin();
    }
    setCreating(false);
    setNewOrg({
      name: '',
      legal_name: '',
      email: '',
      phone: '',
      website: '',
      agency_type: '',
      gov_domain: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
    });
    setSelectedOrgId(data.id as string); // load the newly created org
    setMessage({ type: 'success', text: 'Organization created successfully.' });
  }

  // Logo upload to 'org-logos' bucket
  async function onLogoSelected(file?: File | null) {
    if (!file || !draft) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Max logo size is 5 MB.' });
      return;
    }

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${draft.id ?? 'new'}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) {
        setMessage({ type: 'error', text: 'Failed to upload logo.' });
        return;
      }

      const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path);
      const url = pub?.publicUrl || null;

      setDraft((prev) => (prev ? { ...prev, logo_url: url } : prev));
      setMessage({ type: 'success', text: 'Logo uploaded. Don’t forget to Save changes.' });
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Unexpected error uploading logo.' });
    }
  }

  // Invite link copy
  function copyInviteLink() {
    if (!organization) return;
    const url = buildInviteUrl(organization.id);
    navigator.clipboard
      .writeText(url)
      .then(() => setMessage({ type: 'success', text: 'Invite link copied to clipboard.' }))
      .catch(() => setMessage({ type: 'error', text: 'Could not copy link.' }));
  }

  /* ==================== Derived: filtered rows ==================== */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgList;

    return orgList.filter((o) => {
      const name = (o.name ?? '').toLowerCase();
      const domain = (o.gov_domain ?? '').toLowerCase();
      const website = (o.website ?? '').toLowerCase();
      const city = (o.city ?? '').toLowerCase();
      const state = (o.state ?? '').toLowerCase();
      return (
        name.includes(q) || domain.includes(q) || website.includes(q) || city.includes(q) || state.includes(q)
      );
    });
  }, [orgList, search]);

  /* ==================== Render ==================== */

  if (loading) return <div className="p-10 text-gray-500">Loading organizations…</div>;

  if (!currentUserId || !profile) {
    return (
      <div className="p-10">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-gray-700">Please sign in to manage organizations.</div>
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
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-slate-700" />
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
        </div>
        {!canEdit && (
          <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs text-gray-700">
            <Shield className="h-4 w-4" /> Some content may be read-only
          </div>
        )}
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

      {/* LAYOUT: TABLE (left) + DETAILS/CREATE (right) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT: Organizations table */}
        <section className="lg:col-span-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Organizations</div>
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm"
                  placeholder="Search name, domain, city, state"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {isGlobalAdmin && (
                <button
                  onClick={() => {
                    setCreating(true);
                    setSelectedOrgId(null);
                    setOrganization(null);
                    setDraft(null);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" /> New
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Website / Domain</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">City</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredRows.map((o) => {
                  const isActive = o.id === selectedOrgId;
                  return (
                    <tr
                      key={o.id}
                      className={`${isActive ? 'bg-blue-50/60' : 'hover:bg-gray-50 cursor-pointer'}`}
                      onClick={() => {
                        setCreating(false);
                        setSelectedOrgId(o.id);
                        setMessage(null);
                      }}
                    >
                      <td className="px-4 py-2 text-sm text-gray-900">{o.name || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{o.website ?? o.gov_domain ?? '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{o.city ?? '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{o.state ?? '—'}</td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      No organizations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!isGlobalAdmin && (
            <p className="mt-3 text-xs text-gray-500">You don’t have global admin permissions. Only your own organization is visible.</p>
          )}
        </section>

        {/* RIGHT: Details (when a row is selected) or Create form */}
        <section className="lg:col-span-7 space-y-6">
          {/* Empty State when nothing selected and not creating */}
          {!creating && !selectedOrgId && (
            <div className="rounded-2xl border bg-white p-10 text-center text-sm text-gray-500">
              Select an organization from the table to view details
              {isGlobalAdmin && (
                <>
                  {' '}
                  or{' '}
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setCreating(true);
                      setSelectedOrgId(null);
                    }}
                  >
                    create a new one
                  </button>
                  .
                </>
              )}
            </div>
          )}

          {/* CREATE */}
          {creating && isGlobalAdmin && (
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold mb-4">Create Organization</div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name *" value={newOrg.name} onChange={(v) => setNewOrg((p) => ({ ...p, name: v }))} />
                <Field label="Legal Name" value={newOrg.legal_name ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, legal_name: v }))} />
                <Field label="Email" value={newOrg.email ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, email: v }))} />
                <Field label="Phone" value={newOrg.phone ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, phone: v }))} />
                <Field label="Website" value={newOrg.website ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, website: v }))} placeholder="https://..." />
                <Field label="Agency Type" value={newOrg.agency_type ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, agency_type: v }))} />
                <Field label="Gov Domain" value={newOrg.gov_domain ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, gov_domain: v }))} placeholder="e.g., agency.gov" />

                {/* Address line 1 (CREATE) — Places ref */}
                <Field
                  label="Address line 1"
                  value={newOrg.address_line1 ?? ''}
                  onChange={(v) => setNewOrg((p) => ({ ...p, address_line1: v }))}
                  inputRef={createAddressRef}
                />
                <Field label="Address line 2" value={newOrg.address_line2 ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, address_line2: v }))} />
                <Field label="City" value={newOrg.city ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, city: v }))} />
                <Field label="State / Province" value={newOrg.state ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, state: v }))} />
                <Field label="Postal Code" value={newOrg.postal_code ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, postal_code: v }))} />
                <Field label="Country" value={newOrg.country ?? ''} onChange={(v) => setNewOrg((p) => ({ ...p, country: v }))} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={createOrganization}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-lg border px-4 py-2 shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {/* DETAILS */}
          {!creating && !!selectedOrgId && organization && draft && (
            <>
              {/* Identity & logo */}
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="grid gap-6 md:grid-cols-[auto,1fr] md:items-start">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative h-24 w-24 overflow-hidden rounded-xl ring-1 ring-black/5 bg-gray-100">
                      {draft.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.logo_url} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50"
                        >
                          <Upload className="mr-2 inline h-4 w-4" /> Upload Logo
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onLogoSelected(e.target.files?.[0])}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Organization Name" value={draft.name} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, name: v })} />
                    <Field label="Legal Name" value={draft.legal_name ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, legal_name: v })} />
                    <Field label="Agency Type" value={draft.agency_type ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, agency_type: v })} />
                    <Field label="Gov Domain" value={draft.gov_domain ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, gov_domain: v })} placeholder="e.g., agency.gov" />
                    <Field label="Website" value={draft.website ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, website: v })} placeholder="https://..." />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field label="Email" value={draft.email ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, email: v })} />
                  <Field label="Phone" value={draft.phone ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, phone: v })} />
                </div>
              </section>

              {/* ADDRESS */}
              <SectionCard icon={<Globe2 className="h-5 w-5" />} title="Address" description="Organization mailing address.">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Address line 1 (EDIT) — Places ref */}
                  <Field
                    label="Address line 1"
                    value={draft.address_line1 ?? ''}
                    readOnly={!canEdit}
                    onChange={(v) => setDraft({ ...draft, address_line1: v })}
                    inputRef={editAddressRef}
                  />
                  <Field
                    label="Address line 2"
                    value={draft.address_line2 ?? ''}
                    readOnly={!canEdit}
                    onChange={(v) => setDraft({ ...draft, address_line2: v })}
                  />
                  <Field label="City" value={draft.city ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, city: v })} />
                  <Field label="State / Province" value={draft.state ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, state: v })} />
                  <Field label="Postal Code" value={draft.postal_code ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, postal_code: v })} />
                  <Field label="Country" value={draft.country ?? ''} readOnly={!canEdit} onChange={(v) => setDraft({ ...draft, country: v })} />
                </div>
              </SectionCard>

              {/* ACCESS CONTROLS */}
              <SectionCard title="Access & Registration" description="Control how users can join and access this org.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Toggle
                    label="Allow self registration"
                    checked={!!draft.allow_self_registration}
                    disabled={!canEdit}
                    onChange={(v) => setDraft({ ...draft, allow_self_registration: v })}
                    help="If enabled, users can sign up and request to join this organization."
                  />
                  <Toggle
                    label="Require admin approval"
                    checked={draft.require_admin_approval ?? true}
                    disabled={!canEdit}
                    onChange={(v) => setDraft({ ...draft, require_admin_approval: v })}
                    help="If enabled, an admin must approve new member requests."
                  />
                </div>
              </SectionCard>

              {/* INVITE CLIENTS */}
              <SectionCard title="Invite Clients" description="Share a signup link to let clients join this organization.">
                <div className="grid gap-3 md:grid-cols-[1fr,auto,auto] items-center">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="client@example.com (optional)"
                    className="w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
                  >
                    <Copy className="h-4 w-4" /> Copy Invite Link
                  </button>
                  <a
                    href={`mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent(
                      'Invitation to join organization'
                    )}&body=${encodeURIComponent(
                      `You have been invited to join ${draft?.name ?? 'our organization'}.\n\nUse this link to sign up:\n${buildInviteUrl(
                        organization.id
                      )}\n`
                    )}`}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
                  >
                    <Send className="h-4 w-4" /> Email Link
                  </a>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Tip: The link encodes <code>org_id</code>. Your signup screen should attach new accounts to that org after verification.
                </div>
              </SectionCard>

              {/* SAVE BAR */}
              <div className="sticky bottom-4 z-10 flex justify-end">
                <div className="rounded-xl border bg-white/90 px-4 py-3 shadow backdrop-blur supports-[backdrop-filter]:bg-white/70">
                  <button
                    onClick={saveOrganization}
                    disabled={!canEdit || saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ==================== Reusable UI ==================== */

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
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
    </section>
  );
}

type InputRef =
  | React.RefObject<HTMLInputElement | null>
  | React.MutableRefObject<HTMLInputElement | null>;

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  inputRef,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  /** Optional ref to wire Google Places Autocomplete (for Address line 1 inputs) */
  inputRef?: InputRef;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        ref={(el) => {
          if (inputRef && 'current' in inputRef) inputRef.current = el;
        }}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete="off"
        className={`w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          readOnly ? 'bg-gray-50 text-gray-500' : ''
        }`}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  help,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {help && <div className="text-xs text-gray-500">{help}</div>}
      </div>
      <label className={`relative inline-flex cursor-pointer items-center ${disabled ? 'opacity-60' : ''}`}>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
      </label>
    </div>
  );
}
``
