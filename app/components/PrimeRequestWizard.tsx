
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRecaptchaToken } from '@/lib/security/recaptcha-client';
import { Shield, Landmark, Building2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { FederalForm } from '@/app/components/gov-forms/FederalForm';
import { StateForm } from '@/app/components/gov-forms/StateForm';
import { LocalForm } from '@/app/components/gov-forms/LocalForm';

type Step = 1 | 2 | 3 | 4;
type GovType = 'federal' | 'state' | 'local' | null;
type Mode = 'new' | 'edit';

export default function PrimeRequestWizard({
  mode = 'new',
  initialRequest,
}: {
  mode?: Mode;
  initialRequest?: any;
}) {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [govType, setGovType] = useState<GovType>(null);

  const [formData, setFormData] = useState<any>({});
  const [certified, setCertified] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [trackingId, setTrackingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
    })();
  }, [router]);

  // EDIT PREFILL EFFECT
  useEffect(() => {
    if (mode === 'edit' && initialRequest) {
      setGovType(initialRequest.gov_type);
      setFormData(initialRequest.form_data || {});
      setTrackingId(initialRequest.tracking_id);
      setStep(2);
    }
  }, [mode, initialRequest]);

  const next = () => setStep((p) => (p < 4 ? ((p + 1) as Step) : p));
  const back = () => setStep((p) => (p > 1 ? ((p - 1) as Step) : p));

  // Extract a title/description for table preview & dashboard
  let extracted = { title: '', description: '' };

  if (govType === 'federal') {
    extracted = {
      title: formData?.projectTitle || formData?.agencyName || 'Federal Request',
      description: formData?.description || '',
    };
  } else if (govType === 'state') {
    extracted = {
      title: formData?.projectTitle || formData?.agencyName || 'State Request',
      description: formData?.description || '',
    };
  } else if (govType === 'local') {
    extracted = {
      title: formData?.projectName || formData?.municipality || 'Local Request',
      description: formData?.description || '',
    };
  }

  let canContinueStep2 = false;

  if (govType === 'federal') {
    canContinueStep2 = Boolean(
      formData?.coName?.trim() &&
      formData?.officialEmail?.trim() &&
      formData?.description?.trim()
    );
  } else if (govType === 'state') {
    canContinueStep2 = Boolean(
      formData?.procurementOfficer?.trim() &&
      formData?.email?.trim() &&
      formData?.description?.trim()
    );
  } else if (govType === 'local') {
    canContinueStep2 = Boolean(formData?.description?.trim());
  }
  async function handleSubmit() {
    if (!user || !govType) return;

    // ✅ HARD VALIDATION (business-level protection)
    if (!certified) {
      setSubmitError('You must certify before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // ---------------- AUTH HEADER (REQUIRED for secureRoute w/ roles & org) ----------------
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setSubmitting(false);
        router.push('/login');
        return;
      }

      // ---------------- reCAPTCHA V3 ----------------
      let captchaToken = '';
      try {
        captchaToken = await getRecaptchaToken('submit_request');
      } catch {
        setSubmitError('Security system not ready. Please refresh.');
        setSubmitting(false);
        return;
      }
      if (!captchaToken) {
        setSubmitError('Security verification failed.');
        setSubmitting(false);
        return;
      }

      if (mode === 'edit' && initialRequest?.id) {
        // UPDATE EXISTING REQUEST (direct Supabase update)
        const { error } = await supabase
          .from('service_requests')
          .update({
            gov_type: govType,
            title: extracted.title,
            description: extracted.description,
            form_data: formData,
            status: 'pending',
            admin_status: 'submitted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialRequest.id);

        if (error) throw error;

        // Optional notification (non-blocking)
        try {
          await supabase.functions.invoke('notify-admin', {
            body: {
              trackingId: initialRequest.tracking_id,
              govType,
              title: extracted.title,
              requesterEmail: user.email,
              resubmitted: true,
            },
          });
        } catch (emailError) {
          console.error('Email failed:', emailError);
        }

        setTrackingId(initialRequest.tracking_id);
        setStep(4);
        return;
      }

      // ---------------- CREATE (secure API with captcha + Authorization) ----------------
      const res = await fetch('/api/requests/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`, // <-- critical for secureRoute
        },
        body: JSON.stringify({
          govType,
          extracted,
          formData,
          captchaToken, // <-- secureRoute will find & verify this
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Submission failed.');
      }

      setTrackingId(result.trackingId);
      setStep(4);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to submit request.';
        setSubmitError(message);
      }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-6">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-10 shadow-sm">
        <h1 className="mb-2 text-3xl font-semibold">
          {mode === 'edit' ? 'Edit Government Service Request' : 'Government Service Request'}
        </h1>
        <p className="mb-10 text-gray-500">Submit a formal request for government services.</p>

        <StepIndicator step={step} />

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2 className="mb-6 text-xl font-semibold">Step 1: Select Government Type</h2>

            <div className="mb-10 grid gap-6 md:grid-cols-3">
              <SelectableCard
                icon={Shield}
                title="Federal Government"
                subtitle="Federal agencies & military commands"
                selected={govType === 'federal'}
                onClick={() => {
                  setGovType('federal');
                  setFormData({});
                }}
              />
              <SelectableCard
                icon={Landmark}
                title="State Government"
                subtitle="State agencies & departments"
                selected={govType === 'state'}
                onClick={() => {
                  setGovType('state');
                  setFormData({});
                }}
              />
              <SelectableCard
                icon={Building2}
                title="Local Government"
                subtitle="City / county / municipality"
                selected={govType === 'local'}
                onClick={() => {
                  setGovType('local');
                  setFormData({});
                }}
              />
            </div>

            <div className="flex justify-end">
              <button
                disabled={!govType}
                onClick={next}
                className={`rounded-lg px-6 py-3 font-medium ${
                  govType
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                }`}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Step 2: Request Details</h2>
                <p className="mt-1 text-sm text-gray-500">Complete required fields to proceed.</p>
              </div>
              <button onClick={() => setStep(1)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                Change Type
              </button>
            </div>

            {govType === 'federal' && <FederalForm value={formData} onChange={setFormData} />}
            {govType === 'state' && <StateForm value={formData} onChange={setFormData} />}
            {govType === 'local' && <LocalForm value={formData} onChange={setFormData} />}

            {!canContinueStep2 && (
              <div className="mt-6 flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>Please complete the required fields to continue.</div>
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button onClick={back} className="rounded-lg border px-6 py-3 hover:bg-gray-50">
                Back
              </button>
              <button
                disabled={!canContinueStep2}
                onClick={next}
                className={`rounded-lg px-6 py-3 font-medium ${
                  canContinueStep2
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                }`}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <h2 className="mb-6 text-xl font-semibold">Step 3: Review & Certification</h2>

            <div className="space-y-3 rounded-lg border bg-gray-50 p-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Government Type</span>
                <span className="capitalize text-gray-900">{govType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Title</span>
                <span className="font-medium text-gray-900">{extracted.title || '—'}</span>
              </div>
              <div className="text-sm">
                <div className="mb-1 text-gray-600">Description</div>
                <div className="whitespace-pre-wrap text-gray-900">{extracted.description || '—'}</div>
              </div>
              <div className="text-xs text-gray-500">Full form data will be attached to this request submission.</div>
            </div>

            <label className="mt-6 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => {
                  setCertified(e.target.checked);
                  if (e.target.checked) setSubmitError(null);
                }}
                className="mt-1"
              />
              <span className="text-gray-700">
                I certify that I am authorized to submit this request on behalf of the listed government entity and that the
                information provided is accurate to the best of my knowledge.
              </span>
            </label>

            {submitError && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button onClick={back} className="rounded-lg border px-6 py-3 hover:bg-gray-50">
                Back
              </button>
              <button
                disabled={!certified || submitting}
                onClick={handleSubmit}
                className={`rounded-lg px-6 py-3 font-medium ${
                  certified && !submitting
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                }`}
              >
                {submitting ? 'Submitting...' : mode === 'edit' ? 'Resubmit Request' : 'Submit Request'}
              </button>
            </div>
          </>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="py-14 text-center">
            <CheckCircle className="mx-auto mb-6 h-16 w-16 text-green-600" />
            <h2 className="mb-2 text-2xl font-semibold">Request Submitted Successfully</h2>
            <p className="mb-6 text-gray-500">Your request has been received and is under review.</p>

            <div className="inline-flex items-center gap-2 rounded-xl border bg-gray-50 px-6 py-3">
              <span className="text-sm text-gray-600">Tracking ID:</span>
              <span className="text-lg font-semibold text-gray-900">{trackingId}</span>
            </div>

            <div className="mt-10">
              <button
                onClick={() => router.push('/requests')}
                className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-10 flex items-center justify-between">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex flex-1 items-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step > s ? <CheckCircle className="h-5 w-5" /> : s}
          </div>
          {s !== 4 && <div className={`h-1 flex-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

function SelectableCard({ icon: Icon, title, subtitle, selected, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-8 transition ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="mb-4 flex justify-center">
        <Icon className="h-8 w-8 text-blue-600" />
      </div>
      <h3 className="text-center font-semibold">{title}</h3>
      <p className="mt-1 text-center text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}
