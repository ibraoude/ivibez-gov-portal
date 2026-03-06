'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
};

export default function NewContractPage() {

  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("");

  const [form, setForm] = useState({
    contract_number: "",
    gov_type: "",
    title: "",
    description: "",
    final_amount: "",
    period_of_performance: ""
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const { data, error } = await supabase
      .from("profiles")   // must exist
      .select("id,email")
      .order("email");

    if (error) {
      console.error(error);
      return;
    }

    setUsers(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedOwner) {
      alert("Please select a contractor.");
      return;
    }

    const { error } = await supabase
      .from("contracts")
      .insert({
        contract_number: form.contract_number,
        tracking_id: crypto.randomUUID(),
        source_type: "manual",
        owner_id: selectedOwner, // 🔥 REQUIRED
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
    <div className="max-w-3xl mx-auto py-10 px-6">
      <h1 className="text-2xl font-semibold mb-6">
        Create Manual Contract
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 🔹 Contractor Selection */}
        <select
          value={selectedOwner}
          onChange={e => setSelectedOwner(e.target.value)}
          className="w-full border p-2 rounded"
          required
        >
          <option value="">Select Contractor</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.email}
            </option>
          ))}
        </select>

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