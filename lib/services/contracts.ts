import { createClient } from "@/lib/supabase/client";

export async function approveSubmission(
  submissionId: string,
  contractId: string,
  userId: string,
  userEmail: string,
  reviewNote?: string
) {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error: submissionError } = await supabase
    .from("contract_completion_submissions")
    .update({
      status: "approved",
      admin_review_notes: reviewNote || null,
      reviewed_at: now,
      reviewed_by: userId,
    })
    .eq("id", submissionId);

  if (submissionError) throw submissionError;

  const { error: contractError } = await supabase
    .from("contracts")
    .update({
      completion_status: "approved",
      admin_status: "approved",
      admin_reviewed_at: now,
      admin_reviewed_by: userId,
      approved_for_payment: true,
      payment_status: "pending",
      updated_at: now,
    })
    .eq("id", contractId);

  if (contractError) throw contractError;

  /* CREATE PAYMENT RECORD */

  console.log("Creating payment for contract:", contractId);

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, vendor_id, final_amount")
    .eq("id", contractId)
    .single();

  if (!contract) {
    throw new Error("Contract not found");
  }

  const { data: existingPayment } = await supabase
    .from("contract_payments")
    .select("id")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (!existingPayment) {
    const { error: paymentError } = await supabase
      .from("contract_payments")
      .insert({
        contract_id: contract.id,
        vendor_id: contract.vendor_id,
        amount: contract.final_amount,
        payment_status: "pending"
      });

    if (paymentError) {
      console.error("Payment creation failed:", paymentError);
      throw paymentError;
    }

    console.log("Payment successfully created");
  }

  /* ACTIVITY LOG */

  await supabase.from("contract_activity").insert({
    contract_id: contractId,
    actor_id: userId,
    actor_email: userEmail,
    activity_type: "admin_approved",
    note: reviewNote || null,
  });
}


export async function requestRevision(
  submissionId: string,
  contractId: string,
  userId: string,
  userEmail: string,
  reviewNote?: string
) {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error: submissionError } = await supabase
    .from("contract_completion_submissions")
    .update({
      status: "needs_revision",
      admin_review_notes: reviewNote || null,
      reviewed_at: now,
      reviewed_by: userId,
    })
    .eq("id", submissionId);

  if (submissionError) throw submissionError;

  const { error: contractError } = await supabase
    .from("contracts")
    .update({
      completion_status: "needs_revision",
      admin_status: "needs_revision",
      admin_reviewed_at: now,
      admin_reviewed_by: userId,
      approved_for_payment: false,
      payment_status: "unpaid",
      updated_at: now,
    })
    .eq("id", contractId);

  if (contractError) throw contractError;

  await supabase.from("contract_activity").insert({
    contract_id: contractId,
    actor_id: userId,
    actor_email: userEmail,
    activity_type: "admin_requested_revision",
    note: reviewNote || null,
  });
}