'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Database } from '@/types/database';

type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];

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
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const prefillName = params.get('name') ?? '';
  const prefillEmail = params.get('email') ?? '';
  const returnTo = params.get('returnTo') ?? '/dashboard';

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    name: prefillName,
    legal_name: '',
    email: prefillEmail,
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

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace(`/login?returnTo=${encodeURIComponent('/settings/organizations/new')}`);
        return;
      }
      setMe({ id: data.user.id });
    })();
  }, [router, supabase]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Address autocomplete will be disabled.');
      return;
    }

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        setOptions({ key, v: 'weekly' });
        const placesLib = await importLibrary('places');
        const { Autocomplete } = placesLib as google.maps.PlacesLibrary;

        const read = (type: string, comps: any[], short = false) => {
          const f = comps.find((c: any) => c.types.includes(type));
          return f ? (short ? f.short_name : f.long_name) : '';
        };

        if (addressRef.current) {
          const ac = new Autocomplete(addressRef.current, {
            fields: ['address_components'],
            types: ['address'],
          });

          const listener = ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            const comps: any[] = place?.address_components || [];
            const streetNumber = read('street_number', comps);
            const route = read('route', comps);

            setForm((p) => ({
              ...p,
              address_line1: `${streetNumber} ${route}`.trim(),
              city: read('locality', comps) || read('postal_town', comps),
              state: read('administrative_area_level_1', comps, true),
              postal_code: read('postal_code', comps),
              country: read('country', comps, true),
            }));
          });

          cleanup = () => {
            try {
              listener.remove();
            } catch {}
          };
        }
      } catch (e) {
        console.warn('Google Places init failed', e);
      }
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  function onSelectLogo(file?: File | null) {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'error', text: 'Please select an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Max logo size is 5 MB.' });
      return;
    }
    setMsg(null);
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  const canSubmit =
    form.name.trim().length > 0 &&
    (form.email?.trim().length ?? 0) > 0 &&
    (form.address_line1?.trim().length ?? 0) > 0 &&
    (form.city?.trim().length ?? 0) > 0 &&
    (form.state?.trim().length ?? 0) > 0 &&
    (form.postal_code?.trim().length ?? 0) > 0 &&
    (form.country?.trim().length ?? 0) > 0;

  async function createOrg() {
    if (!me) return;

    if (!form.name.trim()) {
      setMsg({ type: 'error', text: 'Organization name is required.' });
      return;
    }
    if (!form.email?.trim()) {
      setMsg({ type: 'error', text: 'Organization email is required.' });
      return;
    }
    if (!form.address_line1?.trim()) {
      setMsg({ type: 'error', text: 'Address line 1 is required.' });
      return;
    }
    if (!form.city?.trim()) {
      setMsg({ type: 'error', text: 'City is required.' });
      return;
    }
    if (!form.state?.trim()) {
      setMsg({ type: 'error', text: 'State / Province is required.' });
      return;
    }
    if (!form.postal_code?.trim()) {
      setMsg({ type: 'error', text: 'Postal code is required.' });
      return;
    }
    if (!form.country?.trim()) {
      setMsg({ type: 'error', text: 'Country is required.' });
      return;
    }

    setLoading(true);
    setMsg(null);

    const payload: OrganizationInsert = {
      name: form.name.trim(),
      created_by: me.id,
      allow_self_registration: false,
      require_admin_approval: true,
      updated_at: new Date().toISOString(),
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
    };

    const { data: org, error } = await supabase
      .from('organizations')
      .insert([payload])
      .select()
      .single();

    if (error || !org) {
      setMsg({ type: 'error', text: error?.message || 'Failed to create organization.' });
      setLoading(false);
      return;
    }

    const orgId = org.id as string;

    if (logoFile) {
      const ext = (logoFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${orgId}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('org-logos')
        .upload(path, logoFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) {
        setMsg({ type: 'error', text: 'Organization created, but failed to upload logo.' });
      } else {
        const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path);
        const url = pub?.publicUrl ?? null;

        if (url) {
          const { error: updateErr } = await supabase
            .from('organizations')
            .update({ logo_url: url })
            .eq('id', orgId);

          if (updateErr) {
            setMsg({
              type: 'error',
              text: 'Organization created, logo uploaded, but failed to save logo URL.',
            });
          }
        }
      }
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        org_id: orgId,
        role: 'owner',
        updated_at: new Date().toISOString(),
      })
      .eq('id', me.id);

    if (profileUpdateError) {
      setMsg({
        type: 'error',
        text: 'Organization created, but failed to attach your profile as owner.',
      });
      setLoading(false);
      return;
    }

    setMsg({ type: 'success', text: 'Organization created. Redirecting…' });
    router.replace(returnTo.startsWith('/') ? returnTo : '/dashboard');
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

        <section className="grid gap-6">
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 overflow-hidden rounded-xl ring-1 ring-black/5 bg-gray-100">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400 text-xs">
                    No Logo
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50"
                  type="button"
                >
                  Upload Logo
                </button>
                {logoPreview && (
                  <button
                    onClick={() => onSelectLogo(null)}
                    className="rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50"
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onSelectLogo(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="grid gap-4 flex-1">
              <Field
                label="Organization Name *"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                label="Legal Name"
                value={form.legal_name ?? ''}
                onChange={(v) => setForm({ ...form, legal_name: v })}
              />
              <Field
                label="Contact Email *"
                value={form.email ?? ''}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Agency Type"
              value={form.agency_type ?? ''}
              onChange={(v) => setForm({ ...form, agency_type: v })}
            />
            <Field
              label="Gov Domain"
              value={form.gov_domain ?? ''}
              onChange={(v) => setForm({ ...form, gov_domain: v })}
              placeholder="e.g., agency.gov"
            />
          </div>

          <Field
            label="Website"
            value={form.website ?? ''}
            onChange={(v) => setForm({ ...form, website: v })}
            placeholder="https://…"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Address line 1 *"
              value={form.address_line1 ?? ''}
              onChange={(v) => setForm({ ...form, address_line1: v })}
              inputRef={addressRef}
            />
            <Field
              label="Address line 2"
              value={form.address_line2 ?? ''}
              onChange={(v) => setForm({ ...form, address_line2: v })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field
              label="City *"
              value={form.city ?? ''}
              onChange={(v) => setForm({ ...form, city: v })}
            />
            <Field
              label="State / Province *"
              value={form.state ?? ''}
              onChange={(v) => setForm({ ...form, state: v })}
            />
            <Field
              label="Postal Code *"
              value={form.postal_code ?? ''}
              onChange={(v) => setForm({ ...form, postal_code: v })}
            />
          </div>

          <Field
            label="Country *"
            value={form.country ?? ''}
            onChange={(v) => setForm({ ...form, country: v })}
          />
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
            type="button"
          >
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
  inputRef,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        ref={inputRef as any}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}