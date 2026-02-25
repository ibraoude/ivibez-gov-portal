import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ===============================
   CORS CONFIGURATION
================================= */

const allowedOrigins = [
  "https://www.ivibezsolutions.com",
  "https://ivibezsolutions.com",
  "http://localhost:3000"
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
   HANDLE PREFLIGHT
================================= */

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

/* ===============================
   HANDLE POST
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

      // Common fields
      first_name,
      last_name,
      name,
      email,
      phone,
      message,
      service_interest,

      // Government-specific
      organization_name,
      role_type,
      role_other,
      request_type,
      naics_code,
      preferred_contact_time,
      project_scope,

      // Honeypot
      company

    } = body;

    /* ===============================
       HONEYPOT PROTECTION
    ================================= */

    if (company) {
      return NextResponse.json(
        { error: "Bot detected." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       CAPTCHA VALIDATION
    ================================= */

    if (!captchaToken) {
      return NextResponse.json(
        { error: "Missing captcha token." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const verifyRes = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`
      }
    );

    const verifyData = await verifyRes.json();

    console.log("RECAPTCHA VERIFY RESPONSE:", verifyData);

    if (!verifyData.success || verifyData.score < 0.05) {
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       SUPABASE CLIENT (SERVER)
    ================================= */

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let insertData: Record<string, any> = {};
    let table: string | undefined;

    /* ===============================
       MAP FIELDS EXPLICITLY
    ================================= */

    if (formType === "contact") {
      table = "contact_submissions";

      insertData = {
        submission_id: submissionId,
        first_name: first_name || null,
        last_name: last_name || null,
        email: email || null,
        phone: phone || null,
        message: message || null,
        service_interest: service_interest || null,
        page_url,
        referrer,
        user_agent,
        created_at: new Date().toISOString()
      };
    }

    if (formType === "government") {
      table = "gov_submissions";

      insertData = {
        submission_id: submissionId,
        first_name: first_name || null,
        last_name: last_name || null,
        organization_name: organization_name || null,
        email: email || null,
        phone: phone || null,
        role_type: role_type || null,
        role_other: role_other || null,
        request_type: request_type || null,
        naics_code: naics_code || null,
        preferred_contact_time: preferred_contact_time || null,
        project_scope: project_scope || null,
        page_url,
        referrer,
        user_agent,
        created_at: new Date().toISOString()
      };
    }

    if (formType === "realestate") {
      table = "realestate_submissions";

      insertData = {
        submission_id: submissionId,
        first_name: first_name || null,
        last_name: last_name || null,
        email: email || null,
        phone: phone || null,
        role_type: role_type || null,
        role_other: role_other || null,
        preferred_contact_time: preferred_contact_time || null,
        project_scope: project_scope || null,
        page_url,
        referrer,
        user_agent,
        created_at: new Date().toISOString()
      };
    }

    if (!table) {
      return NextResponse.json(
        { error: "Invalid form type." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       INSERT INTO DATABASE
    ================================= */

    const { error } = await supabase
      .from(table)
      .insert(insertData);

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: getCorsHeaders(origin) }
    );

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}