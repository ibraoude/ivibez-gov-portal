
// app/whoami/page.tsx
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function WhoAmI() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  let profile: any = null, error: any = null;
  if (user) {
    const result = await supabase
      .from("profiles")
      .select("id, user_id, org_id")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`) // match either column to see what returns
      .maybeSingle();
    profile = result.data;
    error = result.error?.message ?? null;
  }

  return (
    <pre style={{ padding: 16 }}>
      {JSON.stringify({ user, profile, error }, null, 2)}
    </pre>
  );
}
