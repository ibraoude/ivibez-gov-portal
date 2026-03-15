"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";



type Contract = {
  id: string;
  contract_number: string | null;
  title: string | null;
  final_amount: number | null;
  vendor_id: string | null;
  payment_status: string | null;
};

export default function Page() {
  return (
    <ProtectedPage permission="manageOrganization">
      <PaymentApprovalPage />
    </ProtectedPage>
  );
}
function PaymentApprovalPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContract();
  }, []);

  async function loadContract() {
    const { data } = await supabase
      .from("contracts")
      .select("id, contract_number, title, final_amount, vendor_id, payment_status")
      .eq("id", contractId)
      .single();

    setContract(data);
  }

  async function markPaid() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("contracts")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        paid_by: user?.id,
      })
      .eq("id", contractId);

    await supabase.from("contract_activity").insert({
      contract_id: contractId,
      actor_id: user?.id,
      actor_email: user?.email,
      activity_type: "payment_marked_paid",
      note: `Payment completed. Ref: ${reference}`,
    });

    setSaving(false);

    router.push("/contracts");
  }

  return (
    <main className="max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Payment Approval</h1>

      <div className="rounded-xl border bg-white p-6 space-y-4">
        <div>
          <div className="text-xs text-gray-500">Contract</div>
          <div className="font-medium">{contract?.contract_number}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Amount</div>
          <div className="font-medium">
            ${contract?.final_amount?.toLocaleString()}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Payment Reference</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="ACH / Wire / Check number"
          />
        </div>

        <button
          onClick={markPaid}
          disabled={saving}
          className="rounded-lg bg-green-600 text-white px-4 py-2 hover:bg-green-700"
        >
          {saving ? "Processing..." : "Mark as Paid"}
        </button>
      </div>
    </main>
  );
}