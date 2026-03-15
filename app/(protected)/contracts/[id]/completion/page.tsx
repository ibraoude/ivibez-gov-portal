"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProtectedPage from "@/components/auth/ProtectedPage";

const supabase = createClient();

export default function ContractCompletionPage() {
  return (
    <ProtectedPage>
      <CompletionForm />
    </ProtectedPage>
  );
}

function CompletionForm() {
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;

  const [report, setReport] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const { error } = await supabase
        .from("contracts")
        .update({
          status: "work_submitted",
          deliverables_submitted: true,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      if (error) {
        alert(error.message);
        return;
      }

      router.replace(`/contracts/${contractId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-12">

      <h1 className="text-2xl font-semibold mb-6">
        Submit Contract Completion
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="text-sm font-medium">
            Completion Report
          </label>

          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            className="mt-1 w-full border rounded-lg p-3"
            rows={5}
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Deliverables
          </label>

          <input
            type="file"
            multiple
            onChange={(e) =>
              setFiles(Array.from(e.target.files || []))
            }
          />
        </div>

        <button
          disabled={loading}
          className="rounded-lg bg-blue-600 text-white px-4 py-2"
        >
          {loading ? "Submitting..." : "Submit for Review"}
        </button>

      </form>
    </div>
  );
}