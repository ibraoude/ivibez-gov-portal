
// app/(protected)/contracts/[id]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client"; // browser client factory
import { getRecaptchaToken } from "@/lib/security/recaptcha-client";
import { FileSignature, DollarSign, CalendarRange, Users, Upload } from "lucide-react";
import ContractTimeline from "@/components/contracts/ContractTimeline";
import DeliverablesSection from "@/components/contracts/DeliverablesSection";
import AssignVendor from "@/components/contracts/AssignVendor";
import VendorSubmissions from "@/components/contracts/VendorSubmissions";
import { logContractActivity } from "@/lib/contracts/log-contract-activity";
import { CONTRACT_ACTIVITY_TYPES } from "@/lib/contracts/activity-types";
import ContractActivityTimeline from "@/components/contracts/ContractActivityTimeline";

type FormState = {
  contract_number: string;
  source_type: string;
  gov_type: string;
  title: string;
  description: string;
  final_amount: string;   // keep as string for the input; server will coerce
  period_start: string;
  period_end: string;
  client_id: string;
  status: string;
  admin_status: string;
};

type Vendor = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ContractRow = {
  tracking_id: string | null;
  contract_number: string | null;
  source_type: string | null;
  gov_type: string | null;
  title: string | null;
  description: string | null;
  final_amount: number | null;
  period_start: string | null;
  period_end: string | null;
  client_id: string | null;
  status: string | null;
  admin_status: string | null;
  vendor_id: string | null;
  vendor: Vendor | null;
};

export default function EditContractPage() {
  const router = useRouter();
  const supabase = createClient();

  // In the App Router, useParams() returns a record of route params (string | string[]).
  const params = useParams() as { id: string };
  const id = params.id;

  // ✅ Hooks declared at the top level (unconditional)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    contract_number: "",
    source_type: "manual",
    gov_type: "",
    title: "",
    description: "",
    final_amount: "",
    period_start: "",
    period_end: "",
    client_id: "",
    status: "",
    admin_status: "",
  });
  

  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  };

  // Prefill from Supabase (client-side read)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("contracts")
          .select(`
            tracking_id,
            contract_number,
            source_type,
            gov_type,
            title,
            description,
            final_amount,
            period_start,
            period_end,
            client_id,
            status,
            admin_status,
            vendor_id,
            vendor:profiles!contracts_vendor_id_fkey (
              id,
              full_name,
              email
            )
          `)
          .eq("id", id)
          .single<ContractRow>();

        if (error) throw new Error(error.message);
        if (!data) throw new Error("Contract not found");

        const contract = data as ContractRow;

        // check if vendor submitted completion work
        const { data: submission } = await supabase
          .from("contract_completion_submissions")
          .select("completion_status")
          .eq("contract_id", id)
          .maybeSingle();

        if (submission) {
          setHasSubmission(true);
          setSubmissionStatus(submission.completion_status);
        }

        if (!cancelled) {
          setTrackingId(data.tracking_id ?? null);

          setVendorName(
            data.vendor?.full_name ?? data.vendor?.email ?? "Unnamed Vendor"
          );

          setOriginalStatus(contract.status ?? null);

          setForm({
            contract_number: data.contract_number ?? "",
            source_type: data.source_type ?? "manual",
            gov_type: data.gov_type ?? "",
            title: data.title ?? "",
            description: data.description ?? "",
            final_amount: data.final_amount != null ? String(data.final_amount) : "",
            period_start: data.period_start ?? "",
            period_end: data.period_end ?? "",
            client_id: data.client_id ?? "",
            status: data.status ?? "",
            admin_status: data.admin_status ?? "",
          });
        }
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message || "Failed to load contract");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, supabase]);

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // Prevent double submission
  if (saving) return;

  try {
      setSaving(true);

      // 0) Ensure user session and get access token (for secure-route / RLS)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        router.push("/login");
        return;
      }

      // 1) Captcha v3
      const captchaToken = await getRecaptchaToken("contract_update");

      // 2) Build multipart body for your /api/contracts/[id] PUT handler
      const body = new FormData();
      body.set("captchaToken", captchaToken); // server may accept "captchaToken" or "recaptchaToken"

      body.set("contract_number", form.contract_number ?? "");
      body.set("source_type", form.source_type ?? "manual");
      body.set("gov_type", form.gov_type ?? "");
      body.set("title", form.title ?? "");
      body.set("description", form.description ?? "");
      body.set("final_amount", form.final_amount ?? "");
      body.set("period_start", form.period_start ?? "");
      body.set("period_end", form.period_end ?? "");
      body.set("client_id", form.client_id ?? "");
      body.set("status", form.status ?? "");
      body.set("admin_status", form.admin_status ?? "");

      files.forEach((f) => body.append("files", f));

      // 3) PUT to API (user-scoped via Authorization header)
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });

      const text = await res.text();
      const json = safeParseJSON(text);

      if (!res.ok) {
        const message =
          json?.error ||
          json?.message ||
          text ||
          "Update failed";

        console.error("UPDATE ERROR:", message);
        alert(message);

        return;
      }

      // log contract update
      if (originalStatus && originalStatus !== form.status) {
        await logContractActivity({
          supabase,
          contractId: id,
          activityType: CONTRACT_ACTIVITY_TYPES.STATUS_CHANGED,
          note: `Status changed from ${originalStatus} to ${form.status}`,
          metadata: {
            previous_status: originalStatus,
            new_status: form.status,
          },
        });
      }

      router.push(`/requests`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Early returns happen AFTER hooks—this is valid
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-12 dark:bg-black">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/90 p-10 shadow-xl dark:border-white/10 dark:bg-white/5">
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-100 dark:bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-12 dark:bg-black">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-10 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 dark:bg-black">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/90 p-10 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Edit Contract
          </h1>
          {trackingId && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Tracking ID:</span> {trackingId}
            </p>
          )}
        </div>

        {/* Contract Timeline */}
        <div className="mb-10">
          <ContractTimeline
            status={form.status || "draft"}
            vendorAssigned={!!vendorName}
            submissionStatus={submissionStatus}
          />
        </div>
        {/* Deliverables */}
        <div className="mt-8">
          <DeliverablesSection contractId={id} />
        </div>
        {/* Vendor Submissions */}
        <div className="mt-8">
          <VendorSubmissions contractId={id} />
        </div>
        {/* Contract Activity */}

        <div className="mt-10">
          <Section
            title="Contract Activity"
            icon={<CalendarRange className="h-5 w-5" />}
          >
            <ContractActivityTimeline contractId={id} />
          </Section>
        </div>
        {/* Vendor Assignment */}
        <div className="mt-8 space-y-4">

          {vendorName && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-400/20 dark:bg-green-500/10 dark:text-green-300">
              <div className="font-semibold">Assigned Vendor</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base">👤</span>
                <span>{vendorName}</span>
              </div>
            </div>
          )}

          <AssignVendor
            contractId={id}
            mode={vendorName ? "change" : "assign"}
          />

        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Contract Info */}
          <Section title="Contract Information" icon={<FileSignature className="h-5 w-5" />}>
            <Field
              label="Contract Number"
              name="contract_number"
              value={form.contract_number}
              placeholder="e.g., FED-2026-1123"
              required
              onChange={handleChange}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Source Type"
                name="source_type"
                value={form.source_type}
                onChange={handleChange}
                options={[
                  { value: "manual", label: "Manual" },
                  { value: "request", label: "From Request" },
                ]}
              />
              <Select
                label="Government Type"
                name="gov_type"
                value={form.gov_type}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select Type" },
                  { value: "federal", label: "Federal" },
                  { value: "state", label: "State" },
                  { value: "local", label: "Local" },
                ]}
              />
            </div>
            <Field
              label="Contract Title"
              name="title"
              value={form.title}
              placeholder="Short project description"
              onChange={handleChange}
            />
            <FieldArea
              label="Description"
              name="description"
              value={form.description}
              placeholder="Detailed scope of work or notes"
              rows={4}
              onChange={handleChange}
            />
          </Section>

          {/* Financials */}
          <Section title="Financial Details" icon={<DollarSign className="h-5 w-5" />}>
            <Field
              label="Final Amount"
              name="final_amount"
              type="number"
              value={form.final_amount}
              placeholder="e.g., 250000"
              onChange={handleChange}
            />
          </Section>

          {/* Period */}
          <Section title="Period of Performance" icon={<CalendarRange className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date" name="period_start" type="date" value={form.period_start} onChange={handleChange} />
              <Field label="End Date" name="period_end" type="date" value={form.period_end} onChange={handleChange} />
            </div>
          </Section>

          {/* Ownership */}
          <Section title="Ownership & Assignment" icon={<Users className="h-5 w-5" />}>
            <Field
              label="Client User ID"
              name="client_id"
              value={form.client_id}
              placeholder="UUID (optional)"
              onChange={handleChange}
            />
          </Section>

          {/* Status */}
          <Section title="Status" icon={<FileSignature className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Contract Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select" },
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "at_risk", label: "At Risk" },
                  { value: "completed", label: "Completed" },
                  { value: "closed", label: "Closed" },
                  { value: "terminated", label: "Terminated" },
                ]}
              />
              <Select
                label="Admin Stage"
                name="admin_status"
                value={form.admin_status}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select" },
                  { value: "awarded", label: "Awarded" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "closed", label: "Closed" },
                ]}
              />
            </div>
          </Section>

          {/* Files */}
          <Section title="Attachments" icon={<Upload className="h-5 w-5" />}>
            <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-white/10">
              <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Select files
              </button>
              {!!files.length && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {files.map((f, i) => (
                    <li key={i}>
                      {f.name} <span className="text-xs text-gray-500">({Math.round(f.size / 1024)} KB)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={saving}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </motion.button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- small UI helpers ---------------- */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        {icon}
        {title}
      </div>
      <div className="grid gap-5">{children}</div>
    </div>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }
) {
  const { label, ...rest } = props;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        {...rest}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5"
      />
    </div>
  );
}

function FieldArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }
) {
  const { label, ...rest } = props;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <textarea
        {...rest}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5"
      />
    </div>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Safe JSON parse helper */
function safeParseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
