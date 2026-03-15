"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import ProtectedPage from "@/components/auth/ProtectedPage";

const supabase = createClient();

type Contract = {
  id: string;
  contract_number: string | null;
  title: string | null;
  final_amount: number | null;
  payment_status: string | null;
  vendor: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

function PaymentApprovalList() {

  const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
  const [paidContracts, setPaidContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState("");

  const [pendingTotal, setPendingTotal] = useState(0);
  const [paidTotal, setPaidTotal] = useState(0);

  useEffect(() => {
    loadPendingContracts();
    loadPaidContracts();
  }, []);

  async function loadPendingContracts() {

    const { data } = await supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        final_amount,
        payment_status,
        vendor:profiles (
          first_name,
          last_name,
          email
        )
      `)
      .eq("payment_status", "pending")
      .returns<Contract[]>();

       const rows = data || [];

        setPendingContracts(rows);

        const total = rows.reduce((sum, c) => {
          return sum + (c.final_amount || 0);
        }, 0);

        setPendingTotal(total);
      }

  async function loadPaidContracts() {

    const { data } = await supabase
      .from("contracts")
      .select(`
        id,
        contract_number,
        title,
        final_amount,
        payment_status,
        vendor:profiles (
          first_name,
          last_name,
          email
        )
      `)
      .eq("payment_status", "paid")
      .order("updated_at", { ascending: false })
      .limit(10)
      .returns<Contract[]>();

    const rows = data || [];

    setPaidContracts(rows);

    const total = rows.reduce((sum, c) => {
      return sum + (c.final_amount || 0);
    }, 0);

    setPaidTotal(total);
  }

  const filteredPaid = paidContracts.filter((c) => {

    const vendorName = `${c.vendor?.first_name ?? ""} ${c.vendor?.last_name ?? ""}`.toLowerCase();

    return (
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      vendorName.includes(search.toLowerCase())
    );

  });

  return (
    <main className="p-6 space-y-8">

      <h1 className="text-2xl font-semibold">
        Payment Approvals
      </h1>

      <div className="grid grid-cols-3 gap-4">

        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500">Pending Contracts</div>
          <div className="text-2xl font-semibold">
            {pendingContracts.length}
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500">Pending Amount</div>
          <div className="text-2xl font-semibold">
            ${pendingTotal.toLocaleString()}
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500">Total Paid</div>
          <div className="text-2xl font-semibold">
            ${paidTotal.toLocaleString()}
          </div>
        </div>

      </div>

      {/* Pending Payments */}

      <div className="rounded-xl border bg-white overflow-hidden">

        <div className="px-4 py-3 border-b font-medium">
          Pending Payment Approvals
        </div>

        <table className="w-full text-sm">

          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Contract</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>

          <tbody>

            {pendingContracts.map((c) => {

              const vendorName = `${c.vendor?.first_name ?? ""} ${c.vendor?.last_name ?? ""}`;

              return (
                <tr key={c.id} className="border-t">

                  <td className="px-4 py-3">

                    <div className="font-medium">
                      {c.contract_number}
                    </div>

                    <div className="text-xs text-gray-500">
                      {c.title}
                    </div>

                  </td>

                  <td className="px-4 py-3">

                    <div className="font-medium">
                      {vendorName}
                    </div>

                    <div className="text-xs text-gray-500">
                      {c.vendor?.email}
                    </div>

                  </td>

                  <td className="px-4 py-3">
                    ${c.final_amount?.toLocaleString()}
                  </td>

                  <td className="px-4 py-3">
                    {c.payment_status}
                  </td>

                  <td className="px-4 py-3 text-right">

                    <Link
                      href={`/contracts/payment-approval/${c.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Approve Payment
                    </Link>

                  </td>

                </tr>
              );

            })}

            {pendingContracts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No pending payments.
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>


      {/* Paid Contracts */}

      <div className="space-y-3">

        <div className="flex items-center justify-between">

          <h2 className="text-lg font-semibold">
            Recently Paid
          </h2>

          <input
            type="text"
            placeholder="Search paid contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          />

        </div>

        <div className="rounded-xl border bg-white overflow-hidden">

          <table className="w-full text-sm">

            <thead className="bg-gray-50 text-left">

              <tr>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>

            </thead>

            <tbody>

              {filteredPaid.map((c) => {

                const vendorName = `${c.vendor?.first_name ?? ""} ${c.vendor?.last_name ?? ""}`;

                return (
                  <tr key={c.id} className="border-t">

                    <td className="px-4 py-3">

                      <div className="font-medium">
                        {c.contract_number}
                      </div>

                      <div className="text-xs text-gray-500">
                        {c.title}
                      </div>

                    </td>

                    <td className="px-4 py-3">

                      <div className="font-medium">
                        {vendorName}
                      </div>

                      <div className="text-xs text-gray-500">
                        {c.vendor?.email}
                      </div>

                    </td>

                    <td className="px-4 py-3">
                      ${c.final_amount?.toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {c.payment_status}
                    </td>

                  </tr>
                );

              })}

              {filteredPaid.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No paid contracts found.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

    </main>
  );
}

export default function Page() {

  return (
    <ProtectedPage permission="manageOrganization">
      <PaymentApprovalList />
    </ProtectedPage>
  );
}