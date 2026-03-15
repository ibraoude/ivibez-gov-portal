
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient} from "@/lib/supabase/client"; // client-side supabase (session)
import { getRecaptchaToken } from "@/lib/security/recaptcha-client";
import { FileSignature, DollarSign, CalendarRange, Users, Upload } from "lucide-react";
import ProtectedPage from "@/components/auth/ProtectedPage";


const supabase = createClient();

export default function NewContractPage() {
  return (
    <ProtectedPage permission="manageOrganization">
      <NewContractContent />
    </ProtectedPage>
  );
}

function NewContractContent() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    contract_number: "",
    source_type: "manual",
    gov_type: "",
    title: "",
    description: "",
    final_amount: "",
    period_start: "",
    period_end: "",
    // owner_id is derived on server; org_id also derived from profile.org_id
    client_id: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      // 0) Ensure user is signed in and get the access token for secure-route (RLS)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      // 1) Get a reCAPTCHA v3 token via global helper
      const captchaToken = await getRecaptchaToken("contract_create");

      // 2) Build multipart body
      const body = new FormData();
      body.set("captchaToken", captchaToken); // secure-route will pick this up

      // Send only fields the server needs (org_id and owner_id are derived)
      Object.entries(form).forEach(([k, v]) => body.set(k, String(v ?? "")));
      files.forEach((f) => body.append("files", f));

      // 3) POST to API with Authorization header so secure-route uses user-scoped Supabase
      const res = await fetch("/api/contracts/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });

      const json = await res.json();
      if (!res.ok) {
        console.error(json);
        alert(json.error || "Failed to create contract");
        setLoading(false);
        return;
      }

      router.replace(`/contracts/${json.contract_id}`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 dark:bg-black">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/90 p-10 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Create New Contract
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Tracking ID will be generated automatically after submission.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Contract Info */}
          <Section title="Contract Information" icon={<FileSignature className="h-5 w-5" />}>
            <Field
              label="Contract Number"
              name="contract_number"
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
              placeholder="Short project description"
              onChange={handleChange}
            />
            <FieldArea
              label="Description"
              name="description"
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
              placeholder="e.g., 250000"
              onChange={handleChange}
            />
          </Section>

          {/* Period */}
          <Section title="Period of Performance" icon={<CalendarRange className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date" name="period_start" type="date" onChange={handleChange} />
              <Field label="End Date" name="period_end" type="date" onChange={handleChange} />
            </div>
          </Section>

          {/* Ownership */}
          <Section title="Ownership & Assignment" icon={<Users className="h-5 w-5" />}>
            {/* owner_id is derived on the server; org_id comes from profile.org_id */}
            <Field
              label="Client User ID"
              name="client_id"
              placeholder="UUID (optional)"
              onChange={handleChange}
            />
          </Section>

          {/* Files */}
          <Section title="Attachments" icon={<Upload className="h-5 w-5" />}>
            <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-white/10">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                Select files
              </button>
              {!!files.length && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {files.map((f, i) => (
                    <li key={i}>
                      {f.name}{" "}
                      <span className="text-xs text-gray-500">
                        ({Math.round(f.size / 1024)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Contract"}
          </motion.button>
        </form>
      </div>
    </div>
  );
}

/* ------- small UI pieces (same as before) ------- */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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
