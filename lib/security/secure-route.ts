import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyRecaptchaV3 } from "@/lib/security/recaptcha";
import { rateLimiter, redis } from "@/lib/security/rate-limit";

export type SecureRouteOptions = {
  expectedAction?: string;
  minScore?: number;
  requireCaptcha?: boolean;
  requireOrg?: boolean;
  requiredRoles?: string[];
  logCaptcha?: boolean;

  // new
  enableRateLimit?: boolean;
  enableReplayProtection?: boolean;
};

type ProfileLite = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "org_id" | "role"
>;

export type SecureRouteContext = {
  user: any;
  profile: ProfileLite;
  supabase: SupabaseClient<Database>;
  body: any;
  formData?: FormData;
  captcha?: Awaited<ReturnType<typeof verifyRecaptchaV3>>;
  isPlatformAdmin: boolean;
};

function parseAuthHeader(req: Request) {
  const raw =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";
  return raw.startsWith("Bearer ") ? raw.slice(7) : null;
}

function firstNonEmpty(...vals: (string | null | undefined)[]) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") obj[k] = v;
    }
    return { body: obj, formData: fd, contentType };
  }

  try {
    const b = await req.json();
    return { body: b ?? {}, contentType };
  } catch {
    return { body: {}, contentType };
  }
}

export async function secureRoute(
  req: NextRequest,
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
      enableRateLimit = true,
      enableReplayProtection = false,
    } = options;

    const { body, formData, contentType } = await parseBody(req);

    // 1) Captcha
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
        return NextResponse.json(
          { error: "Missing reCAPTCHA token" },
          { status: 400 }
        );
      }

      const remoteip = getClientIp(req);

      captchaResult = await verifyRecaptchaV3({
        token: captchaToken,
        expectedAction,
        remoteip,
      });

      const scoreOk =
        typeof captchaResult.score === "number"
          ? captchaResult.score >= minScore
          : false;

      const actionOk = expectedAction
        ? captchaResult.action === expectedAction
        : true;

      const allOk = captchaResult.success === true && scoreOk && actionOk;

      if (!allOk) {
        return NextResponse.json({ error: "reCAPTCHA failed" }, { status: 403 });
      }
    }

    // 2) Rate limit
    if (enableRateLimit) {
      const ip = getClientIp(req);
      const method = req.method.toUpperCase();
      const pathname = new URL(req.url).pathname;

      const { success } = await rateLimiter.limit(`${method}:${pathname}:${ip}`);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    // 3) Replay protection
    if (
      enableReplayProtection &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())
    ) {
      const requestId = req.headers.get("x-request-id");

      if (!requestId) {
        return NextResponse.json(
          { error: "Missing x-request-id header" },
          { status: 400 }
        );
      }

      const replayKey = `replay:${requestId}`;
      const existing = await redis.get(replayKey);

      if (existing) {
        return NextResponse.json(
          { error: "Duplicate request detected" },
          { status: 409 }
        );
      }

      await redis.set(replayKey, "1", { ex: 60 });
    }

    // 4) Auth
    const accessToken = parseAuthHeader(req);

    if (!accessToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    // 5) User-scoped client (RLS)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
        },
      }
    );

    // 6) Current user
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userData.user;

    // 7) Profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // 8) Platform admin
    const { data: platformAdmin } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPlatformAdmin = !!platformAdmin;

    // 9) Org / role checks
    if (requireOrg && !isPlatformAdmin && !profile.org_id) {
      return NextResponse.json(
        { error: "User not attached to organization" },
        { status: 403 }
      );
    }

    if (
      requiredRoles.length > 0 &&
      !isPlatformAdmin &&
      !requiredRoles.includes(profile.role ?? "")
    ) {
      return NextResponse.json(
        { error: "Insufficient role privileges" },
        { status: 403 }
      );
    }

    // 10) Optional captcha audit
    if (logCaptcha && captchaResult) {
      try {
        const recordId =
          (globalThis.crypto?.randomUUID?.() as string | undefined) || user.id;

        await supabase.from("audit_logs").insert({
          record_id: recordId,
          table_name: "routes",
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

    // 11) Business handler
    const result = await handler({
      user,
      profile,
      supabase,
      body,
      formData,
      captcha: captchaResult,
      isPlatformAdmin,
    });

    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}