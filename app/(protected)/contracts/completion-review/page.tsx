"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ProtectedPage from "@/components/auth/ProtectedPage";

const supabase = createClient();

type Submission = {
  id: string;
  contract_id: string;
  submitted_at: string | null;
  status: string | null;
  contracts: {
    contract_number: string | null;
    title: string | null;
    vendor: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  } | null;
};

function ReviewListPage() {

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {

    try {

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("contract_completion_submissions")
        .select(`
          id,
          contract_id,
          status,
          submitted_at,
          contracts (
            contract_number,
            title,
            vendor:profiles (
              first_name,
              last_name,
              email
            )
          )
        `)
        .order("submitted_at", { ascending: false })
        .returns<Submission[]>();

      if (error) throw error;

      setSubmissions(data || []);

    } catch (err: any) {

      console.error("Failed to load submissions:", err);
      setError(err.message || "Failed to load submissions");

    } finally {

      setLoading(false);

    }
  }

  return (
    <main className="p-6 space-y-6">

      <h1 className="text-2xl font-semibold">
        Completion Reviews
      </h1>

      <div className="rounded-xl border bg-white overflow-hidden">

        {loading && (
          <div className="p-6 text-sm text-gray-500">
            Loading submissions...
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && submissions.length === 0 && (
          <div className="p-6 text-sm text-gray-500">
            No completion submissions found.
          </div>
        )}

        {!loading && submissions.length > 0 && (
          <table className="w-full text-sm">

            <thead className="bg-gray-50 text-left">

              <tr>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>

            </thead>

            <tbody>

              {submissions.map((s) => {

                const submittedDate = s.submitted_at
                  ? new Date(s.submitted_at).toLocaleDateString()
                  : "—";

                const vendorName = s.contracts?.vendor
                  ? `${s.contracts.vendor.first_name ?? ""} ${s.contracts.vendor.last_name ?? ""}`.trim()
                  : "—";

                return (
                  <tr
                    key={s.id}
                    className="border-t hover:bg-gray-50"
                  >

                    {/* Contract */}
                    <td className="px-4 py-3">

                      <div className="font-medium">
                        {s.contracts?.contract_number || "—"}
                      </div>

                      <div className="text-gray-500 text-xs">
                        {s.contracts?.title || ""}
                      </div>

                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-3">

                      <div className="font-medium">
                        {vendorName}
                      </div>

                      <div className="text-gray-500 text-xs">
                        {s.contracts?.vendor?.email || ""}
                      </div>

                    </td>

                    {/* Submitted */}
                    <td className="px-4 py-3">
                      {submittedDate}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {s.status || "—"}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">

                      <Link
                        href={`/contracts/completion-review/${s.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Review
                      </Link>

                    </td>

                  </tr>
                );

              })}

            </tbody>

          </table>
        )}

      </div>

    </main>
  );
}

export default function Page() {

  return (
    <ProtectedPage permission="approveRequests">
      <ReviewListPage />
    </ProtectedPage>
  );
}