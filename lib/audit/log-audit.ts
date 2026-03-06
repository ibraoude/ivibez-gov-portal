export async function logAudit({
  supabase,
  org_id,
  user_id,
  action,
  entity_type,
  entity_id,
  metadata = {},
}: {
  supabase: any;
  org_id: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata?: any;
}) {
  await supabase.from("audit_logs").insert({
    org_id,
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
  });
}