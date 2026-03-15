// lib/contracts/log-contract-activity.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContractActivityType } from "@/lib/contracts/activity-types";

type LogContractActivityInput = {
  supabase: SupabaseClient<any, any, any>;
  contractId: string;
  activityType: ContractActivityType;
  actorId?: string | null;
  actorEmail?: string | null;
  note?: string | null;
  details?: string | null;
  metadata?: Record<string, any> | null;
};

export async function logContractActivity({
  supabase,
  contractId,
  activityType,
  actorId = null,
  actorEmail = null,
  note = null,
  details = null,
  metadata = {},
}: LogContractActivityInput) {
  const { error } = await supabase.from("contract_activity").insert({
    contract_id: contractId,
    actor_id: actorId,
    actor_email: actorEmail,
    activity_type: activityType,
    note,
    details,
    metadata,
  });

  if (error) {
    throw error;
  }
}