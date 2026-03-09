
// proxy.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Copy cookies Supabase wrote on the pass-through response onto a redirect response. */
function withRefreshedCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c);
  }
  return to;
}

export async function proxy(req: NextRequest) {

  // Ignore Next.js prefetch
  if (req.headers.get("purpose") === "prefetch") {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  const { pathname, search } = req.nextUrl;

  const isLogin = pathname.startsWith("/login");
  const isOrgSettings = pathname.startsWith("/settings/organizations");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // ---- Auth ----
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Adjust protected sections to your app
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/contracts") ||
    pathname.startsWith("/awards") ||
    pathname.startsWith("/invitations") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/requests") ||
    pathname.startsWith("/members");   

  // Guests -> login
  if (!user && isProtected) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnTo", pathname + search);
    return withRefreshedCookies(res, NextResponse.redirect(loginUrl));
  }

  // Logged-in users shouldn't see /login
    if (user && isLogin && req.method === "GET") {
    const returnTo = req.nextUrl.searchParams.get("returnTo");

    // If a return destination exists, go there
    if (returnTo) {
      return withRefreshedCookies(
        res,
        NextResponse.redirect(new URL(returnTo, req.url))
      );
    }

    // Otherwise stay on dashboard
    return withRefreshedCookies(
      res,
      NextResponse.redirect(new URL("/dashboard", req.url))
    );
  }

  // ---- Super-admin bypass (from token metadata) ----
  const appMeta: any = user?.app_metadata ?? {};
  const userMeta: any = user?.user_metadata ?? {};
  const roles: string[] = Array.isArray(appMeta.roles)
    ? appMeta.roles
    : typeof appMeta.role === "string"
    ? [appMeta.role]
    : [];
  const isSuperAdmin =
    roles.includes("admin") ||
    appMeta.role === "admin" ||
    userMeta.role === "admin";
  if (user && isSuperAdmin) return res;

  // ---- Org gate (profiles only) ----

  if (user && pathname.startsWith("/settings") === false) {
    // ❗ Use ONLY the column that exists in your table. You said `user_id` doesn't exist,
    // so filter by the PK `id = auth.uid()`.
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)            // <-- exact match on existing column
      .maybeSingle();

    // Fail open on read error (don't trap users due to RLS/transient errors)
    if (profileErr) {
      console.warn("[proxy] profiles read error:", profileErr.message);
      return res;
    }

    // If profile exists and has an org, allow
    if (profile?.org_id) return res;

    // If profile exists but no org -> send to org creation (preserve intent)
    if (profile && !profile.org_id && pathname !== "/settings/organizations/new") {
      const setupUrl = new URL("/settings/organizations/new", req.url);
      setupUrl.searchParams.set("returnTo", pathname + search);
      return withRefreshedCookies(res, NextResponse.redirect(setupUrl));
    }

    // No profile row -> allow (you can backfill later)
    return res;
  }

  // Pass-through (and deliver any refreshed cookies)
  return res;
}

export const config = {
  matcher: [
    "/login",

    "/dashboard",
    "/dashboard/:path*",

    "/settings",
    "/settings/:path*",

    "/contracts",
    "/contracts/:path*",

    "/awards",
    "/awards/:path*",

    "/invitations",
    "/invitations/:path*",

    "/reports",
    "/reports/:path*",

    "/requests",
    "/requests/:path*",

    "/members",          
    "/members/:path*", 
  ],
};
