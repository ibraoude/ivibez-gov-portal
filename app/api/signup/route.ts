import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRecaptchaV3 } from "@/lib/security/recaptcha";
import { logAudit } from "@/lib/audit/log-audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      recaptchaToken,
      email,
      password,
      first_name,
      last_name,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      country_code,
    } = body ?? {};

    /* ===============================
       BASIC VALIDATION
    ================================= */
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: "Missing captcha token" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    /* ===============================
       CAPTCHA CHECK
    ================================= */
    const captcha = await verifyRecaptchaV3({
      token: recaptchaToken,
      expectedAction: "signup",
    });

    if (!captcha.ok || (captcha.score ?? 0) < 0.7) {
      return NextResponse.json(
        { error: "Security verification failed" },
        { status: 403 }
      );
    }

    /* ===============================
       SERVICE ROLE CLIENT
    ================================= */
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Account already exists with this email" },
        { status: 400 }
      );
    }

    /* ===============================
       CREATE AUTH USER
    ================================= */
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: String(email).toLowerCase(),
        password: String(password),
        email_confirm: true,
        user_metadata: {
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          phone: phone ?? null,

          address_line1: address_line1 ?? null,
          address_line2: address_line2 ?? null,
          city: city ?? null,
          state: state ?? null,
          postal_code: postal_code ?? null,
          country: country ?? null,
          country_code: country_code ?? null,

          company: null,
          role: "vendor"
        }
      });

    if (createErr || !created?.user) {
      console.error("AUTH CREATE ERROR:", createErr);
      return NextResponse.json(
        { error: createErr?.message || "Signup failed" },
        { status: 400 }
      );
    }

    const userId = created.user.id;

    /* ===============================
       AUDIT LOG
    ================================= */
    await logAudit({
      supabase,
      org_id: null,
      user_id: userId,
      action: "user_signed_up",
      entity_type: "user",
      entity_id: userId,
      metadata: {
        captcha_score: captcha.score,
        captcha_action: captcha.action,
      },
    });

    return NextResponse.json(
      { success: true, user_id: userId },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("signup route error", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}