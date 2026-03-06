import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRecaptchaV3 } from "@/lib/security/recaptcha";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const inviteToken = String(body?.inviteToken || "").trim();
    const recaptchaToken = String(body?.recaptchaToken || "").trim();

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Invitation token required" },
        { status: 400 }
      );
    }

    if (!recaptchaToken) {
      return NextResponse.json(
        { error: "Missing reCAPTCHA token" },
        { status: 400 }
      );
    }

    /* =====================================
       🔐 CAPTCHA VALIDATION
    ====================================== */

    const captcha = await verifyRecaptchaV3({
      token: recaptchaToken,
      expectedAction: "invite_preview",
    });

    if (!captcha.ok || (captcha.score ?? 0) < 0.5) {
      return NextResponse.json(
        { error: "Security verification failed" },
        { status: 403 }
      );
    }

    /* =====================================
       🔐 SERVICE ROLE CLIENT (BYPASS RLS)
    ====================================== */

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /* =====================================
       🔍 FETCH INVITATION
    ====================================== */

    const { data: invite, error } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, org_id, expires_at, accepted_at")
      .eq("token", inviteToken)
      .maybeSingle();

    
if (error) {
  console.error("Supabase error fetching invitation:", {
    code: (error as any)?.code,
    message: error.message,
    details: (error as any)?.details,
    hint: (error as any)?.hint,
  });
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}

if (!invite) {
  console.warn("No invitation found for token:", inviteToken);
  return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
}


    /* =====================================
       🔐 VALIDATIONS
    ====================================== */

    if (invite.accepted_at) {
      return NextResponse.json(
        { error: "Invitation already accepted" },
        { status: 400 }
      );
    }

    if (
      invite.expires_at &&
      new Date(invite.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Invitation expired" },
        { status: 400 }
      );
    }

    /* =====================================
       🔍 FETCH ORGANIZATION NAME
    ====================================== */

    let organizationName: string | null = null;

    if (invite.org_id) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", invite.org_id)
        .single();

      organizationName = org?.name ?? null;
    }

    /* =====================================
       ✅ RETURN SAFE PREVIEW DATA
    ====================================== */

    return NextResponse.json({
      success: true,
      email: invite.email,
      role: invite.role,
      organization: organizationName,
      expires_at: invite.expires_at,
    });

  } catch (err: any) {
    console.error("Invite preview error:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}