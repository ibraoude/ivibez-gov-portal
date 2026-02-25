import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

    try {
      // resend logic here
      
      const resend = new Resend(process.env.RESEND_API_KEY!);

      // Send confirmation to client
      await resend.emails.send({
        from: "iVibeZ Solutions <no-reply@ivibezsolutions.com>",
        to: email,
        subject: "We received your request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

            <h2 style="color:#111;">Hi ${first_name || ""},</h2>

            <p>
              Thank you for reaching out to <strong>iVibeZ Solutions</strong>.
              We’ve successfully received your request.
            </p>

            <p>
              Our team will review your submission and respond within 24 hours.
            </p>

            <hr style="margin:20px 0;">

            <h3 style="margin-bottom:10px;">Submission Details</h3>

            <p><strong>Reference ID:</strong> ${submissionId}</p>
            <p><strong>Name:</strong> ${first_name || ""} ${last_name || ""}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}

            <hr style="margin:20px 0;">

            <p style="font-size:14px; color:#555;">
              If you did not submit this request, please ignore this email.
            </p>

            <p style="margin-top:30px;">
              — iVibeZ Solutions Team
            </p>

          </div>
        `
      });

      // Send notification to admin
      await resend.emails.send({
        from: "iVibeZ Solutions <no-reply@ivibezsolutions.com>",
        to: "iedou@ivibezsolutions.com",
        subject: `New ${formType} submission`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

            <h2 style="color:#111;">New ${formType} Submission</h2>

            <hr style="margin:20px 0;">

            <p><strong>Reference ID:</strong> ${submissionId}</p>
            <p><strong>Name:</strong> ${first_name || ""} ${last_name || ""}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}

            ${service_interest ? `<p><strong>Service Interest:</strong> ${service_interest}</p>` : ""}
            ${organization_name ? `<p><strong>Organization:</strong> ${organization_name}</p>` : ""}
            ${naics_code ? `<p><strong>NAICS Code:</strong> ${naics_code}</p>` : ""}

            ${message ? `<p><strong>Message:</strong><br>${message}</p>` : ""}
            ${project_scope ? `<p><strong>Project Scope:</strong><br>${project_scope}</p>` : ""}

            <hr style="margin:20px 0;">

            <p style="font-size:13px; color:#666;">
              Submitted from: ${page_url}
            </p>

          </div>
        `
      });
    } catch (emailErr) {
      console.error("Email failed:", emailErr);
    }


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