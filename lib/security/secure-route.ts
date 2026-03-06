
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyRecaptchaV3 } from "@/lib/security/recaptcha";

export type SecureRouteOptions = {
  expectedAction?: string;
  minScore?: number;                 // route-level threshold (overrides env)
  requireCaptcha?: boolean;          // default: true
  requireOrg?: boolean;              // default: true
  requiredRoles?: string[];          // e.g., ["admin", "owner"]
  logCaptcha?: boolean;              // write a lightweight audit row
};

type ProfileLite = Pick<Database["public"]["Tables"]["profiles"]["Row"], "org_id" | "role">;

export type SecureRouteContext = {
  user: any;
  profile: ProfileLite;                              // only what we fetched
  supabase: SupabaseClient<Database>;                // user-scoped (RLS)
  body: any;                                         // parsed JSON or flattened FormData (strings)
  formData?: FormData;                               // raw FormData if multipart
  captcha?: Awaited<ReturnType<typeof verifyRecaptchaV3>>;
  isPlatformAdmin: boolean;
};

/* ---------------- helpers ---------------- */

function parseAuthHeader(req: Request) {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return raw.startsWith("Bearer ") ? raw.slice(7) : null;
}

function firstNonEmpty(...vals: (string | null | undefined)[]) {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

async function parseBody(req: Request): Promise<{
  body: any;
  formData?: FormData;
  contentType: string;
}> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const b = await req.json();
      return { body: b ?? {}, contentType };
    } catch {
      return { body: {}, contentType };
    }
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") obj[k] = v; // strings only; files remain on formData
    }
    return { body: obj, formData: fd, contentType };
  }

  // Fallback: attempt JSON; otherwise empty
  try {
    const b = await req.json();
    return { body: b ?? {}, contentType };
  } catch {
    return { body: {}, contentType };
  }
}

/* ---------------- main ---------------- */

export async function secureRoute(
  req: Request,
  options: SecureRouteOptions,
  handler: (ctx: SecureRouteContext) => Promise<any>
) {
  try {
    const {
      expectedAction,
      minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5"),
      requireCaptcha = true,
      requireOrg = true,
      requiredRoles = [],
      logCaptcha = false,
    } = options;

    // 1) Body / FormData
    const { body, formData, contentType } = await parseBody(req);

    // 2) Captcha
    let captchaResult: Awaited<ReturnType<typeof verifyRecaptchaV3>> | undefined;
    if (requireCaptcha) {
      const url = new URL(req.url);

      const captchaToken = firstNonEmpty(
        body?.captchaToken,
        body?.recaptchaToken,
        req.headers.get("x-recaptcha-token"),
        url.searchParams.get("captchaToken"),
        url.searchParams.get("recaptchaToken"),
        (formData?.get("captchaToken") as string) || undefined,
        (formData?.get("recaptchaToken") as string) || undefined
      );

      if (!captchaToken) {
        return NextResponse.json({ error: "Missing reCAPTCHA token" }, { status: 400 });
      }

      const remoteip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

      // Your verifier signature: { token, expectedAction, remoteip }
      captchaResult = await verifyRecaptchaV3({
        token: captchaToken,
        expectedAction,
        remoteip,
      });

      const scoreOk =
        typeof captchaResult.score === "number" ? captchaResult.score >= minScore : false;
      const actionOk = expectedAction ? captchaResult.action === expectedAction : true;
      const allOk = captchaResult.success === true && scoreOk && actionOk;

      if (!allOk) {
        return NextResponse.json({ error: "reCAPTCHA failed" }, { status: 403 });
      }
    }

    // 3) Auth
    const accessToken = parseAuthHeader(req);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // 4) User-scoped client (RLS)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // 5) Current user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const user = userData.user;

    // 6) Profile (only what we need)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // 7) Platform admin
    const { data: platformAdmin } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPlatformAdmin = !!platformAdmin;

    // 8) Org / role enforcement
    if (requireOrg && !isPlatformAdmin && !profile.org_id) {
      return NextResponse.json({ error: "User not attached to organization" }, { status: 403 });
    }
    if (requiredRoles.length > 0 && !isPlatformAdmin && !requiredRoles.includes(profile.role ?? "")) {
      return NextResponse.json({ error: "Insufficient role privileges" }, { status: 403 });
    }

    // 9) Optional captcha audit (requires record_id + table_name per your schema)
    if (logCaptcha && captchaResult) {
      try {
        const recordId = (globalThis.crypto?.randomUUID?.() as string | undefined) || user.id;
        await supabase.from("audit_logs").insert({
          // required by your Insert type
          record_id: recordId,
          table_name: "routes",

          // optional/nullable in your schema
          org_id: profile.org_id ?? null,
          user_id: user.id,
          action: "captcha_verified",
          entity_type: "route",
          entity_id: null,
          metadata: {
            expected_action: expectedAction,
            captcha_action: captchaResult.action,
            score: captchaResult.score,
            hostname: captchaResult.hostname,
            error_codes: captchaResult.errorCodes,
            content_type: contentType,
            is_platform_admin: isPlatformAdmin,
          },
        });
      } catch {
        // non-blocking
      }
    }

    // 10) Business handler
    const result = await handler({
      user,
      profile,          // ProfileLite
      supabase,
      body,
      formData,
      captcha: captchaResult,
      isPlatformAdmin,
    });

    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
