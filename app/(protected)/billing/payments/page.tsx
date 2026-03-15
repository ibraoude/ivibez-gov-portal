"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProtectedPage from "@/components/auth/ProtectedPage";

const supabase = createClient();

type Payment = {
  id: string;
  amount: number;
  payment_status: string | null;
  paid_at: string | null;
  contracts: {
    contract_number: string | null;
  } | null;
};

function money(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("contract_payments")
        .select(`
          id,
          amount,
          payment_status,
          paid_at,
          contracts (
            contract_number
          )
        `)
        .order("paid_at", { ascending: false })
        .returns<Payment[]>();

      if (error) throw error;

      setPayments(data ?? []);
    } catch (err: any) {
      console.error("Failed to load payments:", err);
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 space-y-6">

      <h1 className="text-2xl font-semibold">
        Payments
      </h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white overflow-hidden">

        {loading ? (
          <div className="p-6 text-sm text-gray-500">
            Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No payments found.
          </div>
        ) : (
          <table className="w-full text-sm">

            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Paid At</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">

                  <td className="px-4 py-3">
                    {p.contracts?.contract_number ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    {money(p.amount)}
                  </td>

                  <td className="px-4 py-3">
                    {p.payment_status ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    {p.paid_at
                      ? new Date(p.paid_at).toLocaleDateString()
                      : "—"}
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        )}

      </div>

    </main>
  );
}

export default function Page() {
  return (
    <ProtectedPage permission="viewPayments">
      <PaymentsPage />
    </ProtectedPage>
  );
}