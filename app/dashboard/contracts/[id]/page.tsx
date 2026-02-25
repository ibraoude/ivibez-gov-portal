'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Contract = {
  id: string;
  contract_number: string;
  tracking_id: string;
  gov_type: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  progress_percentage: number | null;
  final_amount: number | null;
  period_of_performance: string | null;
  created_at: string | null;
  last_updated: string | null;
};

export default function ContractDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadContract();
  }, [id]);

  async function loadContract() {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setContract(data);
    setLoading(false);
  }

  async function updateStatus(status: string) {
    const { error } = await supabase
      .from("contracts")
      .update({
        status,
        last_updated: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to update status.");
      return;
    }

    await loadContract();
  }

  async function updateProgress(value: number) {
    const { error } = await supabase
      .from("contracts")
      .update({
        progress_percentage: value,
        last_updated: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to update progress.");
      return;
    }

    await loadContract();
  }

  if (loading) {
    return <div className="p-10 text-center">Loading contract...</div>;
  }

  if (!contract) {
    return <div className="p-10 text-center">Contract not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          {contract.contract_number}
        </h1>

        <Link
          href="/admin/contracts"
          className="text-blue-600 text-sm"
        >
          ← Back to Contracts
        </Link>
      </div>

      {/* BASIC INFO */}
      <div className="bg-white p-6 rounded-xl shadow space-y-4">
        <div><strong>Title:</strong> {contract.title || "—"}</div>
        <div><strong>Gov Type:</strong> {contract.gov_type || "—"}</div>
        <div><strong>Status:</strong> {contract.status}</div>
        <div><strong>Final Amount:</strong> {contract.final_amount ? `$${contract.final_amount.toLocaleString()}` : "—"}</div>
        <div><strong>Period of Performance:</strong> {contract.period_of_performance || "—"}</div>
        <div><strong>Last Updated:</strong> {new Date(contract.last_updated || "").toLocaleDateString()}</div>
      </div>

      {/* PROGRESS */}
      <div className="bg-white p-6 rounded-xl shadow space-y-4">
        <h2 className="font-semibold">Progress</h2>

        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-green-600 h-4 rounded-full"
            style={{ width: `${contract.progress_percentage || 0}%` }}
          />
        </div>

        <div className="flex gap-2">
          {[0, 25, 50, 75, 100].map(val => (
            <button
              key={val}
              onClick={() => updateProgress(val)}
              className="px-3 py-1 text-xs bg-gray-200 rounded"
            >
              {val}%
            </button>
          ))}
        </div>
      </div>

      {/* STATUS ACTIONS */}
      <div className="bg-white p-6 rounded-xl shadow space-y-4">
        <h2 className="font-semibold">Lifecycle</h2>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => updateStatus("active")} className="px-3 py-1 bg-blue-600 text-white rounded">
            Mark Active
          </button>

          <button onClick={() => updateStatus("at_risk")} className="px-3 py-1 bg-red-600 text-white rounded">
            Mark At Risk
          </button>

          <button onClick={() => updateStatus("completed")} className="px-3 py-1 bg-green-600 text-white rounded">
            Mark Completed
          </button>

          <button onClick={() => updateStatus("closed")} className="px-3 py-1 bg-gray-900 text-white rounded">
            Close
          </button>

          <button onClick={() => updateStatus("terminated")} className="px-3 py-1 bg-black text-white rounded">
            Terminate
          </button>
        </div>
      </div>

    </div>
  );
}