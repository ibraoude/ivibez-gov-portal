"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProtectedPage from "@/components/auth/ProtectedPage";

const supabase = createClient();

type Payment = {
  id: string;
  amount: number | null;
  payment_status: string | null;
  paid_at: string | null;
  vendor_id: string | null;
  contracts: {
    contract_number: string | null;
  } | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    company: string | null;
  } | null;
};

function money(n: number | null) {
  if (!n) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function PaymentsPage() {

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
          vendor_id,
          contracts (
            contract_number
          ),
          profiles:vendor_id (
            full_name,
            email,
            company
          )
        `)
        .order("created_at", { ascending: false })
        .returns<Payment[]>();

      if (error) throw error;

      setPayments(data || []);

    } catch (err: any) {

      console.error("Failed to load payments:", err);
      setError(err.message || "Failed to load payments");

    } finally {

      setLoading(false);

    }
  }

  async function markPaid(paymentId: string) {

    try {

      setSaving(paymentId);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("contract_payments")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          paid_by: user.id,
        })
        .eq("id", paymentId);

      if (error) throw error;

      await loadPayments();

    } catch (err: any) {

      console.error("Payment update failed:", err);
      alert(err.message || "Payment update failed");

    } finally {

      setSaving(null);

    }
  }

  /* SPLIT DATA WITHOUT useMemo */

  const pendingPayments = payments.filter(
    (p) => p.payment_status === "pending"
  );

  /* FINANCE METRICS */

  const totalPending = pendingPayments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  const paidPaymentsTotal = payments
    .filter((p) => p.payment_status === "paid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const now = new Date();
  const paymentsThisMonth = payments
    .filter((p) => {
      if (!p.paid_at) return false;

      const d = new Date(p.paid_at);

      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const paidPayments = payments.filter((p) => {

    if (p.payment_status !== "paid") return false;

    const contract = p.contracts?.contract_number || "";
    const vendor =
      `${p.profiles?.full_name ?? ""} ${p.profiles?.email ?? ""} ${p.profiles?.company ?? ""}`;

    const matchesSearch =
      contract.toLowerCase().includes(search.toLowerCase()) ||
      vendor.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || p.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <main className="p-6 space-y-10">

      <h1 className="text-2xl font-semibold">
        Payments Management
      </h1>
      {/* FINANCE OVERVIEW */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <FinanceCard
          title="Pending Liability"
          value={money(totalPending)}
        />

        <FinanceCard
          title="Total Paid"
          value={money(paidPaymentsTotal)}
        />

        <FinanceCard
          title="Paid This Month"
          value={money(paymentsThisMonth)}
        />

      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* PENDING PAYMENTS */}

      <section className="space-y-3">

        <h2 className="text-lg font-semibold">
          Pending Payments
        </h2>

        <div className="rounded-xl border bg-white overflow-hidden">

          {loading ? (
            <div className="p-6 text-sm text-gray-500">
              Loading payments...
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No pending payments.
            </div>
          ) : (

            <table className="w-full text-sm">

              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Contract</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody>

                {pendingPayments.map((p) => (

                  <tr key={p.id} className="border-t">

                    <td className="px-4 py-3">
                      {p.contracts?.contract_number ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.profiles?.full_name ?? "Unknown Vendor"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.profiles?.email ?? "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.profiles?.company ?? "—"}
                    </div>
                  </td>

                    <td className="px-4 py-3">
                      {money(p.amount)}
                    </td>

                    <td className="px-4 py-3">

                      <button
                        onClick={() => markPaid(p.id)}
                        disabled={saving === p.id}
                        className="rounded-md bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {saving === p.id ? "Saving..." : "Mark Paid"}
                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

      </section>


      {/* PAYMENT HISTORY */}

      <section className="space-y-3">

        <h2 className="text-lg font-semibold">
          Payment History
        </h2>

        <div className="flex gap-4">

          <input
            placeholder="Search contract or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-64"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
          </select>

        </div>

        <div className="rounded-xl border bg-white overflow-hidden">

          {paidPayments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No payment history found.
            </div>
          ) : (

            <table className="w-full text-sm">

              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Contract</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid At</th>
                </tr>
              </thead>

              <tbody>

                {paidPayments.map((p) => (

                  <tr key={p.id} className="border-t">

                    <td className="px-4 py-3">
                      {p.contracts?.contract_number ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.profiles?.full_name ?? "Unknown Vendor"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.profiles?.email ?? "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.profiles?.company ?? "—"}
                    </div>
                  </td>

                    <td className="px-4 py-3">
                      {money(p.amount)}
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

      </section>

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

function FinanceCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="text-xl font-semibold mt-1">
        {value}
      </p>

    </div>
  );
}