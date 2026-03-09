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

  const cookieStore = await cookies();

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
    const destination =
      params.inviteToken
        ? `/accept?token=${encodeURIComponent(params.inviteToken)}`
        : params.returnTo && params.returnTo !== "/login"
        ? params.returnTo
        : "/dashboard";

    redirect(destination);
  }

  return (
    <LoginForm
      inviteToken={params.inviteToken}
      defaultReturnTo={params.returnTo ?? "/dashboard"}
    />
  );
}