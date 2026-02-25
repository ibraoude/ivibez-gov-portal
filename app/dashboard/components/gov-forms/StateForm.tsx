'use client';

import React, { useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

/* =========================
   TYPES
========================= */

export type StateFormData = {
  state?: string;
  agencyName?: string;
  division?: string;
  address?: string;

  procurementOfficer?: string;
  email?: string;
  phone?: string;
  contractNumber?: string;

  projectTitle?: string;
  budget?: string;
  description?: string;

  methods?: string[];
  preferences?: string[];

  scope?: string;
  deliverables?: string;
  timeline?: string;

  insurance?: string;
  bonding?: string;
  security?: string;
};

type Props = {
  value: StateFormData;
  onChange: (next: StateFormData) => void;
  onCaptchaChange?: (token: string | null) => void;
};

/* =========================
   COMPONENT
========================= */

export function StateForm({ value, onChange, onCaptchaChange }: Props) {
  const v: StateFormData = value ?? {};
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  /* ---------- SAFE FIELD SETTER ---------- */
  function setField<K extends keyof StateFormData>(
    key: K,
    val: StateFormData[K]
  ) {
    onChange({ ...v, [key]: val });
  }

  /* ---------- EXPLICIT ARRAY TOGGLES ---------- */
  function toggleMethod(item: string) {
    const current = v.methods ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];

    setField("methods", updated);
  }

  function togglePreference(item: string) {
    const current = v.preferences ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];

    setField("preferences", updated);
  }

  /* =========================
     UI
  ========================= */

  return (
    <div className="space-y-10">

      {/* SECTION 1 */}
      <Section title="SECTION 1: STATE AGENCY INFORMATION">
        <Grid>
          <Input label="State" value={v.state ?? ""} onChange={(x)=>setField("state", x)} />
          <Input label="Agency / Department Name" value={v.agencyName ?? ""} onChange={(x)=>setField("agencyName", x)} />
          <Input label="Division / Office" value={v.division ?? ""} onChange={(x)=>setField("division", x)} />
          <Input label="Agency Address" value={v.address ?? ""} onChange={(x)=>setField("address", x)} />
        </Grid>
      </Section>

      {/* SECTION 2 */}
      <Section title="SECTION 2: PROCUREMENT AUTHORITY">
        <Grid>
          <Input label="Procurement Officer Name *" required value={v.procurementOfficer ?? ""} onChange={(x)=>setField("procurementOfficer", x)} />
          <Input label="Official Email Address *" required type="email" value={v.email ?? ""} onChange={(x)=>setField("email", x)} />
          <Input label="Phone Number" value={v.phone ?? ""} onChange={(x)=>setField("phone", x)} />
          <Input label="State Contract Number (if applicable)" value={v.contractNumber ?? ""} onChange={(x)=>setField("contractNumber", x)} />
        </Grid>
      </Section>

      {/* SECTION 3 */}
      <Section title="SECTION 3: PROJECT DETAILS">
        <Grid>
          <Input label="Project Title" value={v.projectTitle ?? ""} onChange={(x)=>setField("projectTitle", x)} />
          <Select
            label="Estimated Budget Range"
            value={v.budget ?? ""}
            onChange={(x)=>setField("budget", x)}
            options={["Under $100,000","$100,000 – $500,000","$500,000 – $1M","Over $1M"]}
          />
        </Grid>

        <Textarea
          label="Description of Services Required *"
          required
          value={v.description ?? ""}
          onChange={(x)=>setField("description", x)}
        />

        <ArraySection
          title="Procurement Method"
          items={["ITB","RFP","RFQ","Sole Source","Cooperative Contract"]}
          selected={v.methods ?? []}
          toggle={toggleMethod}
        />
      </Section>

      {/* SECTION 4 */}
      <Section title="SECTION 4: BUSINESS PREFERENCE PROGRAMS">
        <ArraySection
          items={[
            "Small Business Preference",
            "Minority-Owned Business (MBE)",
            "Veteran-Owned Business (VBE)",
            "Disadvantaged Business Enterprise (DBE)",
            "Not Determined"
          ]}
          selected={v.preferences ?? []}
          toggle={togglePreference}
        />
      </Section>

      {/* SECTION 5 */}
      <Section title="SECTION 5: SCOPE & DELIVERABLES">
        <Textarea label="Detailed Scope of Work" value={v.scope ?? ""} onChange={(x)=>setField("scope", x)} />
        <Textarea label="Deliverables Required" value={v.deliverables ?? ""} onChange={(x)=>setField("deliverables", x)} />
        <Input label="Project Timeline / Completion Date" value={v.timeline ?? ""} onChange={(x)=>setField("timeline", x)} />
      </Section>

      {/* SECTION 6 */}
      <Section title="SECTION 6: COMPLIANCE REQUIREMENTS">
        <Textarea label="Insurance Requirements" value={v.insurance ?? ""} onChange={(x)=>setField("insurance", x)} />
        <Select label="Bonding Required?" value={v.bonding ?? ""} onChange={(x)=>setField("bonding", x)} options={["Yes","No"]} />
        <Textarea label="State-Specific Data Security Requirements" value={v.security ?? ""} onChange={(x)=>setField("security", x)} />

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