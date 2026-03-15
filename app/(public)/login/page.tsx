// app/(public)/login/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import LoginForm from "./LoginForm";

type LoginSearchParams = {
  inviteToken?: string;
  returnTo?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;

  const cookieStore = await cookies(); // ✅ must await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    // If the user has no org, go directly to org creation
    if (!profile?.org_id) {
      redirect("/settings/organizations/new");
    }

    if (params.inviteToken) {
      redirect(`/accept?token=${encodeURIComponent(params.inviteToken)}`);
    }

    if (
      params.returnTo &&
      params.returnTo.startsWith("/") &&
      params.returnTo !== "/login"
    ) {
      redirect(params.returnTo);
    }

    redirect("/dashboard");
  }

  return (
    <LoginForm
      inviteToken={params.inviteToken}
      defaultReturnTo={params.returnTo ?? "/dashboard"}
    />
  );
}