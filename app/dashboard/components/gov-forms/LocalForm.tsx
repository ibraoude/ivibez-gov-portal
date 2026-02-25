'use client';

import React, { useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

/* =========================
   TYPES
========================= */

export type LocalFormData = {
  municipality?: string;
  department?: string;
  departmentHead?: string;
  purchasingContact?: string;

  projectName?: string;
  description?: string;
  funding?: string[];

  valueRange?: string;

  procurement?: string[];
  goals?: string[];

  startDate?: string;
  completionDate?: string;
  onsite?: string;
};

type Props = {
  value: LocalFormData;
  onChange: (next: LocalFormData) => void;
  onCaptchaChange?: (token: string | null) => void;
};

/* =========================
   COMPONENT
========================= */

export function LocalForm({ value, onChange, onCaptchaChange }: Props) {
  const v: LocalFormData = value ?? {};
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  /* -------------------------
     SAFE FIELD SETTER
  ------------------------- */
  function setField<K extends keyof LocalFormData>(
    key: K,
    val: LocalFormData[K]
  ) {
    onChange({ ...v, [key]: val });
  }

  /* -------------------------
     EXPLICIT ARRAY TOGGLES
  ------------------------- */
  function toggleFunding(item: string) {
    const current = v.funding ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];
    setField("funding", updated);
  }

  function toggleProcurement(item: string) {
    const current = v.procurement ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];
    setField("procurement", updated);
  }

  function toggleGoals(item: string) {
    const current = v.goals ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];
    setField("goals", updated);
  }

  /* =========================
     UI
  ========================= */

  return (
    <div className="space-y-10">

      {/* SECTION 1 */}
      <Section title="SECTION 1: MUNICIPAL INFORMATION">
        <Grid>
          <Input label="City / County Name" value={v.municipality ?? ""} onChange={(x)=>setField("municipality", x)} />
          <Input label="Department Name" value={v.department ?? ""} onChange={(x)=>setField("department", x)} />
          <Input label="Department Head" value={v.departmentHead ?? ""} onChange={(x)=>setField("departmentHead", x)} />
          <Input label="Purchasing Department Contact" value={v.purchasingContact ?? ""} onChange={(x)=>setField("purchasingContact", x)} />
        </Grid>
      </Section>

      {/* SECTION 2 */}
      <Section title="SECTION 2: PROJECT INFORMATION">
        <Grid>
          <Input label="Project Name" value={v.projectName ?? ""} onChange={(x)=>setField("projectName", x)} />
        </Grid>

        <Textarea
          label="Description of Services Requested *"
          required
          value={v.description ?? ""}
          onChange={(x)=>setField("description", x)}
        />

        <ArraySection
          title="Funding Source"
          items={["Municipal Budget","Federal Pass-Through Funds","State Grant","ARPA","Infrastructure Funding","Other"]}
          selected={v.funding ?? []}
          toggle={toggleFunding}
        />
      </Section>

      {/* SECTION 3 */}
      <Section title="SECTION 3: ESTIMATED VALUE">
        <Select
          label="Estimated Project Value"
          value={v.valueRange ?? ""}
          onChange={(x)=>setField("valueRange", x)}
          options={["Under $10,000","$10,000 – $50,000","$50,000 – $250,000","Over $250,000"]}
        />
      </Section>

      {/* SECTION 4 */}
      <Section title="SECTION 4: PROCUREMENT METHOD">
        <ArraySection
          items={["Informal Quote","Formal Bid","RFP","Cooperative Contract"]}
          selected={v.procurement ?? []}
          toggle={toggleProcurement}
        />
      </Section>

      {/* SECTION 5 */}
      <Section title="SECTION 5: DIVERSITY & PARTICIPATION GOALS">
        <ArraySection
          items={[
            "Local Vendor Preference",
            "Minority-Owned Business Participation",
            "Veteran-Owned Business Participation",
            "Subcontracting Plan Required",
            "Not Applicable"
          ]}
          selected={v.goals ?? []}
          toggle={toggleGoals}
        />
      </Section>

      {/* SECTION 6 */}
      <Section title="SECTION 6: PROJECT TIMELINE">
        <Grid>
          <Input label="Desired Start Date" type="date" value={v.startDate ?? ""} onChange={(x)=>setField("startDate", x)} />
          <Input label="Desired Completion Date" type="date" value={v.completionDate ?? ""} onChange={(x)=>setField("completionDate", x)} />
        </Grid>

        <Textarea
          label="On-Site Requirements"
          value={v.onsite ?? ""}
          onChange={(x)=>setField("onsite", x)}
        />

        <div className="mt-6 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
          <strong>LEGAL DISCLAIMER:</strong> Submission does not constitute a binding agreement.
        </div>

        {/* CAPTCHA */}
        <div className="mt-8 flex justify-center">
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
            onChange={(token) => {
              setCaptchaToken(token);
              if (onCaptchaChange) onCaptchaChange(token);
            }}
          />
        </div>
      </Section>

    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid md:grid-cols-2 gap-4">{children}</div>;
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
};

function Input({ label, value, onChange, type="text", required=false }: InputProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

type TextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

function Textarea({ label, value, onChange, required=false }: TextareaProps) {
  return (
    <label className="block mt-4">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <textarea
        required={required}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="mt-1 w-full min-h-[120px] rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <select
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="">Select...</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

type ArraySectionProps = {
  title?: string;
  items: string[];
  selected: string[];
  toggle: (item: string) => void;
};

function ArraySection({ title, items, selected, toggle }: ArraySectionProps) {
  return (
    <div className="mt-6">
      {title && (
        <p className="text-sm font-medium text-gray-900 mb-2">{title}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map(x => (
          <button
            key={x}
            type="button"
            onClick={() => toggle(x)}
            className={`px-3 py-1.5 rounded-full border text-sm transition ${
              selected.includes(x)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-gray-50"
            }`}
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}