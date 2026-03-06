
// pages/organizations/new.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

type Organization = {
  id: string;
  name: string;
  created_at: string | null;
  created_by: string;
  agency_type: string | null;
  gov_domain: string | null;
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
  updated_at: string | null;
};

export default function NewOrganizationPage() {
  // ✅ useRouter inside the component
  const router = useRouter();

  // Local state
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);

  // Prefills (initialized empty; we’ll hydrate after router.isReady)
  const [prefill, setPrefill] = useState<{ name: string; email: string; returnTo: string }>({
    name: '',
    email: '',
    returnTo: '/login',
  });

  const [form, setForm] = useState<
    Pick<
      Organization,
      | 'name'
      | 'legal_name'
      | 'email'
      | 'agency_type'
      | 'gov_domain'
      | 'website'
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
    agency_type: '',
    gov_domain: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ✅ Read query params safely when router is ready
  useEffect(() => {
    if (!router.isReady) return;

    // name/email/return could be string|string[]|undefined
    const qName = router.query.name;
    const qEmail = router.query.email;
    const qReturn = (router.query.return as string) ?? '/login';

    const name = Array.isArray(qName) ? qName[0] : qName ?? '';
    const email = Array.isArray(qEmail) ? qEmail[0] : qEmail ?? '';

    setPrefill({ name, email, returnTo: qReturn });

    // hydrate the form with prefills
    setForm((prev) => ({
      ...prev,
      name: name,
      email: email,
    }));
  }, [router.isReady, router.query]);

  // ✅ Ensure user session (or redirect to login)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push('/login');
        return;
      }
      setMe({ id: data.user.id });
    })();
  }, [router]);

  const canSubmit = useMemo(() => form.name.trim().length > 0, [form.name]);

  async function createOrg() {
    if (!me) return;
    if (!canSubmit) {
      setMsg({ type: 'error', text: 'Organization name is required.' });
      return;
    }
    setLoading(true);
    setMsg(null);

    const payload: Partial<Organization> = {
      name: form.name.trim(),
      legal_name: form.legal_name?.trim() || null,
      email: form.email?.trim() || null,
      agency_type: form.agency_type?.trim() || null,
      gov_domain: form.gov_domain?.trim() || null,
      website: form.website?.trim() || null,
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      postal_code: form.postal_code?.trim() || null,
      country: form.country?.trim() || null,
      allow_self_registration: false,
      require_admin_approval: true,
      created_by: me.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('organizations')
      .insert(payload)
      .select('id')
      .single();

    setLoading(false);

    if (error) {
      setMsg({ type: 'error', text: error.message || 'Failed to create organization.' });
      return;
    }

    setMsg({ type: 'success', text: 'Organization created. Redirecting…' });
    router.replace(prefill.returnTo || '/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white shadow-xl rounded-2xl p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Create Organization</h1>

        {msg && (
          <div
            className={`rounded-lg p-3 text-sm ${
              msg.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="grid gap-4">
          <Field label="Organization Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Legal Name" value={form.legal_name ?? ''} onChange={(v) => setForm({ ...form, legal_name: v })} />
          <Field label="Contact Email" value={form.email ?? ''} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Agency Type" value={form.agency_type ?? ''} onChange={(v) => setForm({ ...form, agency_type: v })} />
            <Field label="Gov Domain" value={form.gov_domain ?? ''} onChange={(v) => setForm({ ...form, gov_domain: v })} placeholder="e.g., agency.gov" />
          </div>
          <Field label="Website" value={form.website ?? ''} onChange={(v) => setForm({ ...form, website: v })} placeholder="https://…" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Address line 1" value={form.address_line1 ?? ''} onChange={(v) => setForm({ ...form, address_line1: v })} />
            <Field label="Address line 2" value={form.address_line2 ?? ''} onChange={(v) => setForm({ ...form, address_line2: v })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="City" value={form.city ?? ''} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="State / Province" value={form.state ?? ''} onChange={(v) => setForm({ ...form, state: v })} />
            <Field label="Postal Code" value={form.postal_code ?? ''} onChange={(v) => setForm({ ...form, postal_code: v })} />
          </div>
          <Field label="Country" value={form.country ?? ''} onChange={(v) => setForm({ ...form, country: v })} />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg border hover:bg-gray-50" type="button">
            Cancel
          </button>
          <button
            onClick={createOrg}
            disabled={!canSubmit || loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            type="button"
          >
            {loading ? 'Creating…' : 'Create Organization'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}
``
