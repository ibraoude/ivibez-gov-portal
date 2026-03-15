"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Submission = {
  id: string;
  description: string | null;
  file_url: string | null;
  completion_status: string | null;
  created_at: string;
};

export default function VendorSubmissions({
  contractId,
}: {
  contractId: string;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    setLoading(true);

    const { data, error } = await supabase
      .from("contract_completion_submissions")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });

    if (!error) {
      setSubmissions((data ?? []) as Submission[]);
    }

    setLoading(false);
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold">Vendor Submissions</h3>

      {loading && (
        <div className="text-sm text-gray-500">
          Loading submissions...
        </div>
      )}

      {!loading && submissions.length === 0 && (
        <div className="text-sm text-gray-500">
          No submissions yet.
        </div>
      )}

      {submissions.map((s) => (
        <div
          key={s.id}
          className="border rounded p-3 flex justify-between items-center"
        >
          <div>
            <div className="font-medium">
              {s.description ?? "Completion Submission"}
            </div>

            <div className="text-xs text-gray-500">
              {new Date(s.created_at).toLocaleDateString()}
            </div>

            {s.completion_status && (
              <div className="text-xs mt-1 text-gray-600">
                Status: {s.completion_status}
              </div>
            )}
          </div>

          {s.file_url && (
            <a
              href={s.file_url}
              target="_blank"
              className="text-blue-600 text-sm"
            >
              View File
            </a>
          )}
        </div>
      ))}
    </div>
  );
}