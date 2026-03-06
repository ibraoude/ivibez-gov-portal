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
        },
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
       UPDATE PROFILE
       (trigger already created it)
    ================================= */
    const { error: profileUpdateErr } = await supabase
      .from("profiles")
      .update({
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        phone: phone ?? null,
        email: String(email).toLowerCase(),
        address_line1: address_line1 ?? null,
        address_line2: address_line2 ?? null,
        city: city ?? null,
        state: state ?? null,
        postal_code: postal_code ?? null,
        country: country ?? null,
        country_code: country_code ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileUpdateErr) {
      console.error("PROFILE UPDATE ERROR:", profileUpdateErr);
      return NextResponse.json(
        { error: profileUpdateErr.message },
        { status: 500 }
      );
    }

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