import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {

  // Ignore Next.js prefetch requests
  const isPrefetch =
    req.headers.get("purpose") === "prefetch" ||
    req.headers.get("x-middleware-prefetch") === "1";

  if (isPrefetch) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/contracts") ||
    pathname.startsWith("/awards") ||
    pathname.startsWith("/requests") ||
    pathname.startsWith("/members") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings");

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value: "",
            ...options,
            expires: new Date(0),
            maxAge: 0,
            path: options?.path ?? "/",
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
  Not logged in
  */

  if (!user && isProtected) {
    const login = new URL("/login", req.url);
    login.searchParams.set("returnTo", pathname + search);
    return NextResponse.redirect(login);
  }

  /*
  Check org using JWT
  */

  const token = req.cookies.get("sb-access-token")?.value;

  if (token && isProtected) {

    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );

    const orgId = payload.org_id;

    if (!orgId && !pathname.startsWith("/settings/organizations")) {

      return NextResponse.redirect(
        new URL("/settings/organizations/new", req.url)
      );
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/contracts/:path*",
    "/awards/:path*",
    "/requests/:path*",
    "/members/:path*",
    "/reports/:path*",
    "/settings/:path*"
  ]
};