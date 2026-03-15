"use client";
// app/(protected)/vendor/contracts/[id]/complete/page.tsx

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";

type ContractRow = {
  id: string;
  contract_number: string | null;
  title: string | null;
  final_amount: number | null;
  completion_status: string | null;
};

export default function Page() {
  return (
    <ProtectedPage permission="submitCompletion">
      <SubmitCompletionPage />
    </ProtectedPage>
  );
}

function SubmitCompletionPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id as string;

  const [contract, setContract] = useState<ContractRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [form, setForm] = useState({
    completion_notes: "",
    work_summary: "",
    start_date: "",
    end_date: "",
    total_hours: "",
    materials_used: "",
  });

  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!contractId) return;
    loadContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  async function loadContract() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("contracts")
      .select("id, contract_number, title, final_amount, completion_status")
      .eq("id", contractId)
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const contractData = data as ContractRow;
    setContract(contractData);
    setAlreadySubmitted(
      contractData?.completion_status === "submitted" ||
      contractData?.completion_status === "approved"
    );
    setLoading(false);
  }

  async function handleSubmit() {
    if (saving || uploading || formDisabled) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

     // DATE VALIDATION
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      setError("End date cannot be before start date.");
      setSaving(false);
      return;
  }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be signed in.");
        setSaving(false);
        return;
      }

      // Double-check in DB before inserting
     let submission = null;
      let submissionError = null;

      for (let attempt = 0; attempt < 3; attempt++) {

        const { data: lastSubmission } = await supabase
          .from("contract_completion_submissions")
          .select("revision_number")
          .eq("contract_id", contractId)
          .order("revision_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextRevision = (lastSubmission?.revision_number || 0) + 1;

        const result = await supabase
          .from("contract_completion_submissions")
          .insert({
            contract_id: contractId,
            submitted_by: user.id,
            revision_number: nextRevision,
            completion_notes: form.completion_notes || null,
            work_summary: form.work_summary || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            total_hours: form.total_hours ? Number(form.total_hours) : null,
            materials_used: form.materials_used || null,
            status: "submitted",
          })
          .select()
          .single();

        submission = result.data;
        submissionError = result.error;

        if (!submissionError) break;

        if (submissionError.code !== "23505") break;
      }

      if (submissionError || !submission) {
        setError(submissionError?.message || "Failed to submit completion.");
        setSaving(false);
        return;
      }

      if (file) {
        setUploading(true);

        const allowedTypes = [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/jpg"
        ];

        if (!allowedTypes.includes(file.type)) {
          setError("Only PDF or image files are allowed.");
          setSaving(false);
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          setError("File must be smaller than 10MB.");
          setSaving(false);
          return;
        }
        
        const ext = file.name.split(".").pop() || "bin";
        const path = `contracts/${contractId}/${submission.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("contract-completion-files")
          .upload(path, file, {
            upsert: true,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadError) {
          setError(`Submission created, but file upload failed: ${uploadError.message}`);
          setUploading(false);
          setSaving(false);
          return;
        }
        

        const { error: documentError } = await supabase
          .from("contract_completion_documents")
          .insert({
            contract_id: contractId,
            submission_id: submission.id,
            uploaded_by: user.id,
            file_name: file.name,
            file_path: path,
            document_type: "completion_report",
          });

        if (documentError) {
          setError(`Submission created, but document record failed: ${documentError.message}`);
          setUploading(false);
          setSaving(false);
          return;
        }

        setUploading(false);
      }

      const now = new Date().toISOString();

      const { error: contractUpdateError } = await supabase
        .from("contracts")
        .update({
          completion_status: "submitted",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", contractId);

      if (contractUpdateError) {
        setError(`Submission saved, but contract update failed: ${contractUpdateError.message}`);
        setSaving(false);
        return;
      }

      const { error: activityError } = await supabase.from("contract_activity").insert({
        contract_id: contractId,
        actor_id: user.id,
        actor_email: user.email,
        activity_type: "completion_submitted",
        note: "Vendor submitted contract completion package.",
        details: {
          hours: form.total_hours,
          materials: form.materials_used,
          start_date: form.start_date,
          end_date: form.end_date
        }
      });

      if (activityError) {
        setError(`Submission saved, but activity log failed: ${activityError.message}`);
        setSaving(false);
        return;
      }

      setAlreadySubmitted(true);
      setSuccess("Completion submitted successfully.");
      setSaving(false);

      setTimeout(() => {
        router.push("/vendor/contracts");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
      setUploading(false);
    }
  }

  const formDisabled =
    saving ||
    uploading ||
    (alreadySubmitted && contract?.completion_status !== "needs_revision");

  if (loading) {
    return <main className="p-6">Loading contract...</main>;
  }

  return (
    <main className="max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Submit Completion</h1>
        <p className="text-sm text-gray-600">
          Contract {contract?.contract_number || "—"} — {contract?.title || "Untitled"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <label className="text-sm font-medium">Completion Notes</label>
          <textarea
            value={form.completion_notes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, completion_notes: e.target.value }))
            }
            rows={4}
            disabled={formDisabled}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Work Summary</label>
          <textarea
            value={form.work_summary}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, work_summary: e.target.value }))
            }
            rows={4}
            disabled={formDisabled}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, start_date: e.target.value }))
              }
              disabled={formDisabled}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="text-sm font-medium">End Date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, end_date: e.target.value }))
              }
              disabled={formDisabled}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Total Hours</label>
          <input
            type="number"
            value={form.total_hours}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, total_hours: e.target.value }))
            }
            disabled={formDisabled}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Materials Used</label>
          <textarea
            value={form.materials_used}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, materials_used: e.target.value }))
            }
            rows={3}
            disabled={formDisabled}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Upload Supporting Document</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={formDisabled}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          />
          {file && (
            <p className="text-xs text-gray-500 mt-1">
              Selected file: {file.name}
            </p>
          )}
        </div>
        <div className="pt-2">
          <button
            onClick={handleSubmit}
            disabled={formDisabled}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving || uploading
              ? "Submitting..."
              : alreadySubmitted
              ? "Completion Already Submitted"
              : "Submit Completion"}
          </button>
        </div>
      </section>
    </main>
  );
}