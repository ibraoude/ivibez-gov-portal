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
        subject:
          formType === "realestate"
            ? "🏠 New Real Estate Inquiry"
            : formType === "government"
            ? "🏛 New Government Inquiry"
            : "📩 New Contact Message",
        html: `
          <div style="background:#f8fafc; padding:40px 20px;">
            <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05); font-family:Arial, sans-serif;">

              <!-- Header -->
              <div style="background:#0f172a; padding:24px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size:22px;">
                  iVibeZ Solutions
                </h1>
              </div>

              <!-- Body -->
              <div style="padding:30px;">

                <h2 style="margin-top:0; color:#111;">
                  Hi ${first_name || "there"},
                </h2>

                <p style="color:#444; line-height:1.6;">
                  Thank you for reaching out. We’ve successfully received your request
                  and our team is reviewing it.
                </p>

                <p style="color:#444; line-height:1.6;">
                  You can expect a response within <strong>24 hours</strong>.
                </p>

                <!-- Reference Card -->
                <div style="margin:30px 0; padding:20px; background:#f1f5f9; border-radius:10px;">
                  <p style="margin:0; font-size:14px; color:#555;">
                    <strong>Reference ID</strong><br>
                    <span style="font-size:16px; color:#0f172a;">
                      ${submissionId}
                    </span>
                  </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="https://www.ivibezsolutions.com"
                    style="display:inline-block; padding:14px 28px; background:#16a34a; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:bold;">
                    Visit Our Website
                  </a>
                </div>

                <p style="font-size:14px; color:#666;">
                  If you did not submit this request, please ignore this email.
                </p>

                <p style="margin-top:30px; color:#111;">
                  — The iVibeZ Solutions Team
                </p>

              </div>

              <!-- Footer -->
              <div style="background:#f8fafc; padding:20px; text-align:center; font-size:12px; color:#777;">
                © ${new Date().getFullYear()} iVibeZ Solutions. All rights reserved.
              </div>

            </div>
          </div>
          `
      });

      // Send notification to admin
      await resend.emails.send({
        from: "iVibeZ Solutions <no-reply@ivibezsolutions.com>",
        to: "iedou@ivibezsolutions.com",
        subject:
          formType === "realestate"
            ? "🏠 New Real Estate Inquiry"
            : formType === "government"
            ? "🏛 New Government Inquiry"
            : "📩 New Contact Message",
        html: `
          <div style="background:#f8fafc; padding:40px 20px;">
            <div style="max-width:650px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05); font-family:Arial, sans-serif;">

              <!-- Header -->
              <div style="background:#111827; padding:24px;">
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  New ${formType.toUpperCase()} Submission
                </h1>
              </div>

              <!-- Body -->
              <div style="padding:30px;">

                <!-- Info Grid -->
                <div style="display:grid; gap:12px; font-size:14px;">

                  <div><strong>Reference ID:</strong> ${submissionId}</div>
                  <div><strong>Name:</strong> ${first_name || ""} ${last_name || ""}</div>
                  <div><strong>Email:</strong> ${email}</div>
                  ${phone ? `<div><strong>Phone:</strong> ${phone}</div>` : ""}

                  ${service_interest ? `<div><strong>Service Interest:</strong> ${service_interest}</div>` : ""}
                  ${organization_name ? `<div><strong>Organization:</strong> ${organization_name}</div>` : ""}
                  ${naics_code ? `<div><strong>NAICS Code:</strong> ${naics_code}</div>` : ""}

                </div>

                ${(message || project_scope) ? `
                <div style="margin-top:25px; padding:20px; background:#f1f5f9; border-radius:10px;">
                  <strong>Message:</strong>
                  <p style="margin-top:10px; line-height:1.6; color:#333;">
                    ${message || project_scope}
                  </p>
                </div>
                ` : ""}

                <div style="margin-top:25px; font-size:12px; color:#777;">
                  Submitted from: ${page_url}
                </div>

              </div>

              <!-- Footer -->
              <div style="background:#f8fafc; padding:18px; text-align:center; font-size:12px; color:#777;">
                Internal Notification • iVibeZ Solutions
              </div>

            </div>
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