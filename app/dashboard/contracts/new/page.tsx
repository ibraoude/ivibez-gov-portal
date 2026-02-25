'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewContractPage() {

  const router = useRouter();

  const [form, setForm] = useState({
    contract_number: "",
    gov_type: "",
    title: "",
    description: "",
    final_amount: "",
    period_of_performance: ""
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase
      .from("contracts")
      .insert({
        contract_number: form.contract_number,
        tracking_id: crypto.randomUUID(),
        source_type: "manual",
        gov_type: form.gov_type,
        title: form.title,
        description: form.description,
        final_amount: form.final_amount
          ? Number(form.final_amount)
          : null,
        period_of_performance: form.period_of_performance,
        status: "draft"
      });

    if (error) {
      console.error(error);
      alert("Failed to create contract");
      return;
    }

    alert("Contract created successfully");
    router.push("/admin/contracts");
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">
        Create Manual Contract
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          placeholder="Contract Number"
          value={form.contract_number}
          onChange={e => setForm({...form, contract_number: e.target.value})}
          className="w-full border p-2 rounded"
          required
        />

        <select
          value={form.gov_type}
          onChange={e => setForm({...form, gov_type: e.target.value})}
          className="w-full border p-2 rounded"
          required
        >
          <option value="">Select Gov Type</option>
          <option value="federal">Federal</option>
          <option value="state">State</option>
          <option value="local">Local</option>
        </select>

        <input
          placeholder="Title"
          value={form.title}
          onChange={e => setForm({...form, title: e.target.value})}
          className="w-full border p-2 rounded"
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({...form, description: e.target.value})}
          className="w-full border p-2 rounded"
        />

        <input
          type="number"
          placeholder="Final Amount"
          value={form.final_amount}
          onChange={e => setForm({...form, final_amount: e.target.value})}
          className="w-full border p-2 rounded"
        />

        <input
          placeholder="Period of Performance"
          value={form.period_of_performance}
          onChange={e => setForm({...form, period_of_performance: e.target.value})}
          className="w-full border p-2 rounded"
        />

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Create Contract
        </button>
      </form>
    </div>
  );
}