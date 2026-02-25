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
   HANDLE PREFLIGHT (OPTIONS)
================================= */

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

/* ===============================
   HANDLE POST REQUEST
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
      ...formFields
    } = body;

    if (!captchaToken) {
      return NextResponse.json(
        { error: "Missing captcha token" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       VERIFY RECAPTCHA
    ================================= */

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



    if (!verifyData.success || verifyData.score < 0.5) {
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       CONNECT TO SUPABASE
    ================================= */

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /* ===============================
       DETERMINE TARGET TABLE
    ================================= */

    let table: string | undefined;

    if (formType === "contact") table = "contact_submissions";
    if (formType === "government") table = "gov_submissions";
    if (formType === "realestate") table = "realestate_submissions";

    if (!table) {
      return NextResponse.json(
        { error: "Invalid form type" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    /* ===============================
       INSERT INTO DATABASE
    ================================= */

    const { error } = await supabase
      .from(table)
      .insert({
        submission_id: submissionId,
        ...formFields,
        page_url,
        referrer,
        user_agent,
        created_at: new Date().toISOString()
      });

    if (error) {
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
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}