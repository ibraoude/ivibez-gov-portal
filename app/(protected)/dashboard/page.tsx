
// app/(protected)/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import DashboardClient from "./DashboardClient";
import ProtectedPage from "@/components/auth/ProtectedPage";

// (Optional) If you keep the type in a shared file, import it instead.
// import type { GovernmentContract } from "@/types";
interface GovernmentContract {
  id: string;
  contract_number?: string;
  tracking_id: string;
  gov_type: string;
  title: string;
  status: string;
  final_amount?: number;
  period_of_performance?: string;
  progress_percentage?: number;
  created_at: string;
  last_updated?: string;
  period_start?: Date | string;
  period_end?: Date | string;
}

export default async function Page() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  // Server-side auth check (no spinner)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=/dashboard");
  }

  // Fetch initial data on the server for instant paint
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  // ✅ Normalize null -> [] and keep a precise type
  const contracts: GovernmentContract[] = (data ?? []) as GovernmentContract[];

  return (
    <ProtectedPage permission="viewReports">
      <DashboardClient user={user} initialContracts={contracts} />
    </ProtectedPage>
  );
}
