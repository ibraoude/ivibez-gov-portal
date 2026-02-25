'use client'

import { useEffect, useMemo, useState } from "react";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shield, Landmark, Building2, CheckCircle, AlertTriangle } from "lucide-react";

import { FederalForm } from "@/app/dashboard/components/gov-forms/FederalForm";
import { StateForm } from "@/app/dashboard/components/gov-forms/StateForm";
import { LocalForm } from "@/app/dashboard/components/gov-forms/LocalForm";

type Step = 1 | 2 | 3 | 4;
type GovType = "federal" | "state" | "local" | null;

type Mode = "new" | "edit";

function PrimeRequestWizard({
  mode = "new",
  initialRequest,
}: {
  mode?: Mode;
  initialRequest?: any;
}) {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  const [step, setStep] = useState<Step>(1);
  const [govType, setGovType] = useState<GovType>(null);

  const [formData, setFormData] = useState<any>({});
  const [certified, setCertified] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
    })();
  }, [router]);


  // EDIT PREFILL EFFECT
  useEffect(() => {
  if (mode === "edit" && initialRequest) {
    setGovType(initialRequest.gov_type);
    setFormData(initialRequest.form_data || {});
    setTrackingId(initialRequest.tracking_id);
    setStep(2);
  }

}, [mode, initialRequest]);

  const next = () => setStep((p) => (p < 4 ? ((p + 1) as Step) : p));
  const back = () => setStep((p) => (p > 1 ? ((p - 1) as Step) : p));

  // Extract a title/description for table preview & dashboard
  const extracted = useMemo(() => {
    if (!govType) return { title: "", description: "" };

    if (govType === "federal") {
      return {
        title: formData?.projectTitle || formData?.agencyName || "Federal Request",
        description: formData?.description || "",
      };
    }
    if (govType === "state") {
      return {
        title: formData?.projectTitle || formData?.agencyName || "State Request",
        description: formData?.description || "",
      };
    }
    return {
      title: formData?.projectName || formData?.municipality || "Local Request",
      description: formData?.description || "",
    };
  }, [govType, formData]);

  const canContinueStep2 = useMemo(() => {
    if (!govType) return false;

    // enforce required fields based on your original specs
    if (govType === "federal") {
      return Boolean(formData?.coName?.trim() && formData?.officialEmail?.trim() && formData?.description?.trim());
    }
    if (govType === "state") {
      return Boolean(formData?.procurementOfficer?.trim() && formData?.email?.trim() && formData?.description?.trim());
    }
    if (govType === "local") {
      return Boolean(formData?.description?.trim());
    }
    return false;
  }, [govType, formData]);

  async function handleSubmit() {
    if (!user || !govType) return;

    // ✅ HARD VALIDATION (business-level protection)
    if (!certified) {
      setSubmitError("You must certify before submitting.");
      return;
    }
    if (!executeRecaptcha) {
      setSubmitError("Security system not ready. Please refresh.");
      return;
    }

    const token = await executeRecaptcha("submit_request");

    if (!token) {
      setSubmitError("Security verification failed.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {

      if (mode === "edit" && initialRequest?.id) {

        // UPDATE EXISTING REQUEST (keeps tracking_id)
        const { error } = await supabase
          .from("service_requests")
          .update({
            gov_type: govType,
            title: extracted.title,
            description: extracted.description,
            form_data: formData,
            status: "pending",
            admin_status: "submitted",
            updated_at: new Date().toISOString()
          })
          .eq("id", initialRequest.id);

        if (error) throw error;

        try {
          await supabase.functions.invoke("notify-admin", {
            body: {
              trackingId: initialRequest.tracking_id,
              govType,
              title: extracted.title,
              requesterEmail: user.email,
              resubmitted: true,
            },
          });
        } catch (emailError) {
          console.error("Email failed:", emailError);
        }

        setTrackingId(initialRequest.tracking_id);
        setStep(4);
        return;
      }

      // 🆕 NEW REQUEST (secure API version)

    const res = await fetch("/api/requests/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        userEmail: user.email,
        govType,
        extracted,
        formData,
        captchaToken: token,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Submission failed.");
    }

    setTrackingId(result.trackingId);
    setStep(4);
      

    } catch (e: any) {
      setSubmitError(e.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm p-10">

        <h1 className="text-3xl font-semibold mb-2">
          {mode === "edit"
            ? "Edit Government Service Request"
            : "Government Service Request"}
        </h1>
        <p className="text-gray-500 mb-10">Submit a formal request for government services.</p>

        <StepIndicator step={step} />

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold mb-6">Step 1: Select Government Type</h2>

            <div className="grid md:grid-cols-3 gap-6 mb-10">
              <SelectableCard
                icon={Shield}
                title="Federal Government"
                subtitle="Federal agencies & military commands"
                selected={govType === "federal"}
                onClick={() => {
                  setGovType("federal");
                  setFormData({});
                }}
              />
              <SelectableCard
                icon={Landmark}
                title="State Government"
                subtitle="State agencies & departments"
                selected={govType === "state"}
                onClick={() => {
                  setGovType("state");
                  setFormData({});
                }}
              />
              <SelectableCard
                icon={Building2}
                title="Local Government"
                subtitle="City / county / municipality"
                selected={govType === "local"}
                onClick={() => {
                  setGovType("local");
                  setFormData({});
                }}
              />
            </div>

            <div className="flex justify-end">
              <button
                disabled={!govType}
                onClick={next}
                className={`px-6 py-3 rounded-lg font-medium ${
                  govType
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">Step 2: Request Details</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Complete required fields to proceed.
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-sm px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Change Type
              </button>
            </div>

            {/* Render correct form */}
            {govType === "federal" && <FederalForm value={formData} onChange={setFormData} />}
            {govType === "state" && <StateForm value={formData} onChange={setFormData} />}
            {govType === "local" && <LocalForm value={formData} onChange={setFormData} />}

            {!canContinueStep2 && (
              <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 flex gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div>
                  Please complete the required fields to continue.
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button onClick={back} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                Back
              </button>
              <button
                disabled={!canContinueStep2}
                onClick={next}
                className={`px-6 py-3 rounded-lg font-medium ${
                  canContinueStep2
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
            <h2 className="text-xl font-semibold mb-6">Step 3: Review & Certification</h2>

            <div className="border rounded-lg p-6 bg-gray-50 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Government Type</span>
                <span className="font-medium text-gray-900 capitalize">{govType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Title</span>
                <span className="font-medium text-gray-900">{extracted.title || "—"}</span>
              </div>
              <div className="text-sm">
                <div className="text-gray-600 mb-1">Description</div>
                <div className="text-gray-900 whitespace-pre-wrap">{extracted.description || "—"}</div>
              </div>
              <div className="text-xs text-gray-500">
                Full form data will be attached to this request submission.
              </div>
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
                I certify that I am authorized to submit this request on behalf of the listed government entity and that the information provided is accurate to the best of my knowledge.
              </span>
            </label>

            {submitError && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button onClick={back} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                Back
              </button>
              <button
                disabled={!certified || submitting}
                onClick={handleSubmit}
                className={`px-6 py-3 rounded-lg font-medium ${
                  certified && !submitting
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {submitting
                  ? "Submitting..."
                  : mode === "edit"
                    ? "Resubmit Request"
                    : "Submit Request"}
              </button>
            </div>
          </>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="text-center py-14">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Request Submitted Successfully</h2>
            <p className="text-gray-500 mb-6">
              Your request has been received and is under review.
            </p>

            <div className="inline-flex items-center gap-2 rounded-xl border bg-gray-50 px-6 py-3">
              <span className="text-sm text-gray-600">Tracking ID:</span>
              <span className="text-lg font-semibold text-gray-900">{trackingId}</span>
            </div>

            <div className="mt-10">
              <button
                onClick={() => router.push("/dashboard/requests")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
    <div className="flex items-center justify-between mb-10">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex-1 flex items-center">
          <div
            className={`w-10 h-10 flex items-center justify-center rounded-full font-semibold ${
              step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {step > s ? <CheckCircle className="h-5 w-5" /> : s}
          </div>
          {s !== 4 && (
            <div className={`flex-1 h-1 ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SelectableCard({ icon: Icon, title, subtitle, selected, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl p-8 border transition ${
        selected ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:shadow-md"
      }`}
    >
      <div className="mb-4 flex justify-center">
        <Icon className="h-8 w-8 text-blue-600" />
      </div>
      <h3 className="text-center font-semibold">{title}</h3>
      <p className="text-center text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

export default function WrappedPrimeRequestWizard(props: any) {
  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
    >
      <PrimeRequestWizard {...props} />
    </GoogleReCaptchaProvider>
  );
}