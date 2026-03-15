//app/(protected)/contracts/completion-review/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";
import {
  approveSubmission,
  requestRevision
} from "@/lib/services/contracts";



type SubmissionRow = {
  id: string;
  contract_id: string;
  completion_notes: string | null;
  work_summary: string | null;
  status: string;
  admin_review_notes: string | null;
  submitted_at: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  file_url: string | null;
  file_path: string | null;
  document_type: string;
};

type SubmissionHistoryRow = {
  id: string;
  revision_number: number;
  status: string;
  submitted_at: string;
};

export default function Page() {
  return (
    <ProtectedPage permission="approveRequests">
      <VendorContractsPage />
    </ProtectedPage>
  );
}
function VendorContractsPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const submissionId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionHistoryRow[]>([]);
  

 useEffect(() => {
    if (submissionId) {
      loadSubmission();
    }
  }, [submissionId]);

  async function loadSubmission() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("contract_completion_submissions")
      .select("id, contract_id, completion_notes, work_summary, status, admin_review_notes, submitted_at")
      .eq("id", submissionId)
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSubmission(data as SubmissionRow);

    const { data: docs, error: docsError } = await supabase
      .from("contract_completion_documents")
      .select("id, file_name, file_url, file_path, document_type")
      .eq("submission_id", submissionId);

    if (docsError) {
      setError(docsError.message);
    }

    const documentsData = (docs ?? []) as DocumentRow[];

    // generate signed URLs for private bucket files
    const signedDocs = await Promise.all(
      documentsData.map(async (doc) => {
        if (!doc.file_path) return doc;

        const { data } = await supabase.storage
          .from("contract-completion-files")
          .createSignedUrl(doc.file_path, 3600);

        return {
          ...doc,
          file_url: data?.signedUrl ?? null,
        };
      })
    );

    setDocuments(signedDocs);


    const { data: history, error: historyError } = await supabase
      .from("contract_completion_submissions")
      .select("id, revision_number, status, submitted_at")
      .eq("contract_id", data.contract_id)
      .order("revision_number", { ascending: true });
      

    if (historyError) {
      setError(historyError.message);
    }
    setSubmissionHistory((history ?? []) as SubmissionHistoryRow[]);

    /* RISK ANALYSIS */

    const flags: string[] = [];

    if (!data?.completion_notes && !data?.work_summary) {
      flags.push("Submission contains very little written detail.");
    }

    if (documentsData.length === 0) {
      flags.push("No supporting documents uploaded.");
    }

    if (data?.submitted_at) {
      const submittedDate = new Date(data.submitted_at);
      const now = new Date();

      const diffDays =
        (now.getTime() - submittedDate.getTime()) /
        (1000 * 60 * 60 * 24);

      if (diffDays < 1) {
        flags.push(
          "Completion submitted very quickly. Verify work timeline."
        );
      }
    }

    setRiskFlags(flags);

    setLoading(false);
      }

  async function updateSubmission(nextStatus: "needs_revision" | "approved") {
    if (!submission) return;

    if (submission.status === "approved") {
      setError("This submission has already been approved.");
      return;
    }

    setSaving(true);
    setError(null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    if (nextStatus === "approved") {
      await approveSubmission(
        submission.id,
        submission.contract_id,
        user.id,
        user.email!,
        reviewNote
      );
    } else {
      await requestRevision(
        submission.id,
        submission.contract_id,
        user.id,
        user.email!,
        reviewNote
      );
    }

    router.push("/contracts");

  } catch (err) {
    setError(err instanceof Error ? err.message : "Operation failed");
  }

  setSaving(false);
}

  if (loading) {
    return <main className="p-6">Loading submission...</main>;
  }

  return (
    <main className="max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Completion Review</h1>
        <p className="text-sm text-gray-600">Review submitted contract closeout package.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div>
          <div className="text-xs text-gray-500">Submission Status</div>
          <div className="font-medium">{submission?.status}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Completion Notes</div>
          <div>{submission?.completion_notes || "—"}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Work Summary</div>
          <div>{submission?.work_summary || "—"}</div>
        </div>

        {riskFlags.length > 0 && (
          <section className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
            
            <h2 className="text-sm font-semibold text-yellow-800 mb-2">
              Review Flags
            </h2>

            <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
              {riskFlags.map((flag, index) => (
                <li key={index}>{flag}</li>
              ))}
            </ul>

          </section>
        )}
        {submissionHistory.length > 0 && (
          <section className="rounded-xl border bg-gray-50 p-4">
            <h2 className="text-sm font-semibold mb-2">
              Submission History
            </h2>

            <div className="space-y-1 text-sm">
              {submissionHistory.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>
                    Revision {s.revision_number}
                  </span>

                  <span className="text-gray-500">
                    {s.status} — {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div>
          <div className="text-xs text-gray-500 mb-2"
          >Documents
          </div>
          <div className="space-y-2">
            {documents.length === 0 ? (
              <div className="text-sm text-gray-500">No documents attached.</div>
            ) : (
              documents.map((doc) => {
                const fileUrl = doc.file_url;

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <div className="font-medium">{doc.file_name}</div>
                      <div className="text-xs text-gray-500">{doc.document_type}</div>
                    </div>

                    {fileUrl && (
                      <div className="flex gap-3 text-sm">
                        
                        <button
                          onClick={() => {
                            setPreviewUrl(fileUrl);
                            setPreviewName(doc.file_name);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Preview
                        </button>

                        <a
                          href={fileUrl}
                          download
                          className="text-gray-600 hover:underline"
                        >
                          Download
                        </a>

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Review Note</label>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Add review comments or revision instructions..."
          />
        </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => updateSubmission("needs_revision")}
          disabled={saving}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          {saving ? "Processing..." : "Request Revision"}
        </button>

        <button
          onClick={() => updateSubmission("approved")}
          disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Processing..." : "Approve Submission"}
        </button>
      </div>
      </section>
      {previewUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          
          <div className="bg-white rounded-xl shadow-xl w-[90%] max-w-4xl h-[80%] flex flex-col">

            <div className="flex items-center justify-between border-b p-4">
              <div className="font-medium">{previewName}</div>

              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewName(null);
                }}
                className="text-gray-500 hover:text-black"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title="Document Preview"
              />
            </div>

          </div>

        </div>
      )}
    </main>
  );
}