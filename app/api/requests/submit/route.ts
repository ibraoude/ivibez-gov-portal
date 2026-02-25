import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { captchaToken } = body;

    if (!captchaToken) {
      return NextResponse.json(
        { error: "Missing captcha token" },
        { status: 400 }
      );
    }

    // 🔐 Verify reCAPTCHA v3 with Google
    const verifyRes = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
      }
    );

    const verifyData = await verifyRes.json();
    console.log("RECAPTCHA VERIFY RESPONSE:", verifyData);

    // ✅ v3 MUST check score
    if (
      !verifyData.success ||
      verifyData.score < 0.5 ||
      verifyData.action !== "submit_request"
    ) {
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400 }
      );
    }

    // ✅ Create Supabase Admin Client (server only)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 📝 Insert into service_requests (NOT contracts)
    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        gov_type: body.govType,
        submitted_by: body.userId,
        requester_email: body.userEmail,
        title: body.extracted.title,
        description: body.extracted.description,
        form_data: body.formData,
        status: "pending",
        admin_status: "submitted",
        awarded: false,
      })
      .select("tracking_id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      trackingId: data.tracking_id,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}