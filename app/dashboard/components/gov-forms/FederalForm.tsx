'use client';

import React, { useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

/* =========================
   TYPES
========================= */

export type FederalFormData = {
  agencyName?: string;
  subAgency?: string;
  programOffice?: string;
  agencyAddress?: string;
  uei?: string;

  programManager?: string;
  coName?: string;
  contractSpecialist?: string;
  officialEmail?: string;
  phone?: string;

  fundingAllocated?: string;
  estimatedValue?: string;
  naics?: string;
  setAsides?: string[];
  vehicles?: string[];

  projectTitle?: string;
  period?: string;
  place?: string;
  description?: string;

  dataSensitivity?: string;
  clearance?: string;
  compliance?: string[];

  evaluation?: string;
  reporting?: string;
  kpis?: string;
};

type Props = {
  value: FederalFormData;
  onChange: (next: FederalFormData) => void;
  onCaptchaChange?: (token: string | null) => void;
};

/* =========================
   COMPONENT
========================= */

export function FederalForm({ value, onChange, onCaptchaChange }: Props) {
  const v: FederalFormData = value ?? {};
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  function setField<K extends keyof FederalFormData>(
    key: K,
    val: FederalFormData[K]
  ) {
    onChange({ ...v, [key]: val });
  }

  function toggleSetAside(item: string) {
    const current = v.setAsides ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];

    setField("setAsides", updated);
  }

  function toggleVehicle(item: string) {
    const current = v.vehicles ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];

    setField("vehicles", updated);
  }

  function toggleCompliance(item: string) {
    const current = v.compliance ?? [];
    const updated = current.includes(item)
      ? current.filter(x => x !== item)
      : [...current, item];

    setField("compliance", updated);
  }

  return (
    <div className="space-y-10">

      <Section title="SECTION 1: AGENCY INFORMATION">
        <Grid>
          <Input label="Federal Agency Name" value={v.agencyName ?? ""} onChange={(x)=>setField("agencyName", x)} />
          <Input label="Sub-Agency / Bureau / Command" value={v.subAgency ?? ""} onChange={(x)=>setField("subAgency", x)} />
          <Input label="Program Office / Division" value={v.programOffice ?? ""} onChange={(x)=>setField("programOffice", x)} />
          <Input label="Agency Address" value={v.agencyAddress ?? ""} onChange={(x)=>setField("agencyAddress", x)} />
          <Input label="Agency UEI (if available)" value={v.uei ?? ""} onChange={(x)=>setField("uei", x)} />
        </Grid>
      </Section>

      <Section title="SECTION 2: AUTHORIZED PERSONNEL">
        <Grid>
          <Input label="Program Manager Name" value={v.programManager ?? ""} onChange={(x)=>setField("programManager", x)} />
          <Input label="Contracting Officer (CO) Name *" value={v.coName ?? ""} onChange={(x)=>setField("coName", x)} required />
          <Input label="Contract Specialist (if applicable)" value={v.contractSpecialist ?? ""} onChange={(x)=>setField("contractSpecialist", x)} />
          <Input label="Official .gov or .mil Email *" value={v.officialEmail ?? ""} onChange={(x)=>setField("officialEmail", x)} type="email" required />
          <Input label="Phone Number" value={v.phone ?? ""} onChange={(x)=>setField("phone", x)} />
        </Grid>
      </Section>

      <Section title="SECTION 3: PROCUREMENT DETAILS">
        <Grid>
          <Select label="Is funding currently allocated?"
            value={v.fundingAllocated ?? ""}
            onChange={(x)=>setField("fundingAllocated", x)}
            options={["Yes","No","Pending Approval"]}
          />
          <Select label="Estimated Contract Value"
            value={v.estimatedValue ?? ""}
            onChange={(x)=>setField("estimatedValue", x)}
            options={["Under $250,000","$250,000 – $1M","$1M – $5M","Over $5M"]}
          />
          <Input label="NAICS Code (if known)" value={v.naics ?? ""} onChange={(x)=>setField("naics", x)} />
        </Grid>

        <ArraySection
          title="Anticipated Set-Aside Type"
          items={["Small Business","8(a)","SDVOSB","VOSB","HUBZone","WOSB","Full & Open","Undetermined"]}
          selected={v.setAsides ?? []}
          toggle={toggleSetAside}
        />

        <ArraySection
          title="Contract Vehicle (if known)"
          items={["GSA Schedule","IDIQ","BPA","GWAC","Standalone RFP","Sole Source","Other"]}
          selected={v.vehicles ?? []}
          toggle={toggleVehicle}
        />
      </Section>

      <Section title="SECTION 4: PROJECT SCOPE">
        <Grid>
          <Input label="Project Title" value={v.projectTitle ?? ""} onChange={(x)=>setField("projectTitle", x)} />
          <Input label="Period of Performance" value={v.period ?? ""} onChange={(x)=>setField("period", x)} />
          <Select label="Place of Performance"
            value={v.place ?? ""}
            onChange={(x)=>setField("place", x)}
            options={["On-Site","Remote","Hybrid"]}
          />
        </Grid>

        <Textarea
          label="Detailed Description of Services Required *"
          value={v.description ?? ""}
          onChange={(x)=>setField("description", x)}
          required
        />
      </Section>

      <Section title="SECTION 5: COMPLIANCE & SECURITY">
        <Grid>
          <Select label="Does this involve sensitive/classified data?"
            value={v.dataSensitivity ?? ""}
            onChange={(x)=>setField("dataSensitivity", x)}
            options={["No","FOUO / CUI","Classified"]}
          />
          <Input label="Clearance Requirements (if any)" value={v.clearance ?? ""} onChange={(x)=>setField("clearance", x)} />
        </Grid>

        <ArraySection
          title="Applicable Compliance Framework"
          items={["NIST 800-53","NIST 800-171","FISMA","FedRAMP","CMMC","HIPAA","CJIS","Other"]}
          selected={v.compliance ?? []}
          toggle={toggleCompliance}
        />
      </Section>

      <Section title="SECTION 6: EVALUATION & PERFORMANCE">
        <Grid>
          <Select label="Evaluation Method"
            value={v.evaluation ?? ""}
            onChange={(x)=>setField("evaluation", x)}
            options={["LPTA","Best Value Tradeoff","Undetermined"]}
          />
          <Select label="Reporting Frequency"
            value={v.reporting ?? ""}
            onChange={(x)=>setField("reporting", x)}
            options={["Weekly","Monthly","Quarterly","Other"]}
          />
        </Grid>

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
   UI HELPERS (STRICTLY TYPED)
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
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
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
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
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
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(e.target.value)
        }
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
  title: string;
  items: string[];
  selected: string[];
  toggle: (item: string) => void;
};

function ArraySection({ title, items, selected, toggle }: ArraySectionProps) {
  return (
    <div className="mt-6">
      <p className="text-sm font-medium text-gray-900 mb-2">{title}</p>
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