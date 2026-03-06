
// lib/supabase/index.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client (anon key).
 * Use in Client Components for auth/session, and in pages to read public data.
 * Do NOT put service role keys here.
 */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
