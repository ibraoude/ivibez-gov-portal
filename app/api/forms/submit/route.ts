import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { verifyRecaptchaV3 } from "@/lib/security/recaptcha";

/* ===============================
   CORS CONFIGURATION
================================= */

const allowedOrigins = [
  "https://www.ivibezsolutions.com",
  "https://ivibezsolutions.com",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* ===============================
   PREFLIGHT
================================= */

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

/* ===============================
   POST
================================= */

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();

    const {
      captchaToken,
      formType,
      submissionId,
      page_url,
      referrer,
      user_agent,
      first_name,
      last_name,
      email,
      phone,
      message,
      service_interest,
      organization_name,
      role_type,
      role_other,
      request_type,
      naics_code,
      preferred_contact_time,
      project_scope,
      company, // honeypot
    } = body;

    /* ===============================
       HONEYPOT
    ================================= */

    if (company) {
      return NextResponse.json(
        { error: "Bot detected." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       CAPTCHA (v3)
    ================================= */

    if (!captchaToken) {
      return NextResponse.json(
        { error: "Missing captcha token." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const captcha = await verifyRecaptchaV3({
      token: captchaToken,
      expectedAction: "public_form_submit",
    });

    if (!captcha.ok || (captcha.score ?? 0) < 0.7) {
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       SUPABASE SERVER CLIENT
    ================================= */

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let insertData: Record<string, any> = {};
    let table: string | undefined;

    const baseFields = {
      submission_id: submissionId,
      page_url,
      referrer,
      user_agent,
      created_at: new Date().toISOString(),
    };

    if (formType === "contact") {
      table = "contact_submissions";
      insertData = {
        ...baseFields,
        first_name: first_name || null,
        last_name: last_name || null,
        email: email || null,
        phone: phone || null,
        message: message || null,
        service_interest: service_interest || null,
      };
    }

    if (formType === "government") {
      table = "gov_submissions";
      insertData = {
        ...baseFields,
        first_name,
        last_name,
        organization_name,
        email,
        phone,
        role_type,
        role_other,
        request_type,
        naics_code,
        preferred_contact_time,
        project_scope,
      };
    }

    if (formType === "realestate") {
      table = "realestate_submissions";
      insertData = {
        ...baseFields,
        first_name,
        last_name,
        email,
        phone,
        role_type,
        role_other,
        preferred_contact_time,
        project_scope,
      };
    }

    if (!table) {
      return NextResponse.json(
        { error: "Invalid form type." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const { error } = await supabase.from(table).insert(insertData);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       EMAIL (RESEND)
    ================================= */

    try {
      const resend = new Resend(process.env.RESEND_API_KEY!);

      await resend.emails.send({
        from: "iVibeZ Solutions <no-reply@ivibezsolutions.com>",
        to: email,
        subject: "We received your request",
        html: `<p>Thank you for your submission. Reference ID: ${submissionId}</p>`,
      });

      await resend.emails.send({
        from: "iVibeZ Solutions <no-reply@ivibezsolutions.com>",
        to: "iedou@ivibezsolutions.com",
        subject: `New ${formType} submission`,
        html: `<p>Submission ID: ${submissionId}</p>`,
      });
    } catch (emailErr) {
      console.error("Email failed:", emailErr);
    }

    return NextResponse.json(
      { success: true },
      { headers: getCorsHeaders(origin) }
    );

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}