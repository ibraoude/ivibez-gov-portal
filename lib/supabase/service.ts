
// lib/supabase/service.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ServiceSupabase = SupabaseClient<Database>;

/** Server-only client (SERVICE ROLE KEY!). Never import in browser code. */
export function createServiceClient(): ServiceSupabase {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
``
