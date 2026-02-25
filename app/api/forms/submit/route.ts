import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      captchaToken,
      formType,
      submissionId,
      page_url,
      referrer,
      user_agent
    } = body;

    if (!captchaToken) {
      return NextResponse.json({ error: "Missing captcha token" }, { status: 400 });
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

    if (!verifyData.success || verifyData.score < 0.5) {
      return NextResponse.json({ error: "Security verification failed." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let table;

    if (formType === "contact") table = "contact_submissions";
    if (formType === "government") table = "gov_submissions";
    if (formType === "realestate") table = "realestate_submissions";

    if (!table) {
      return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
    }

    const { error } = await supabase
      .from(table)
      .insert({
        submission_id: submissionId,
        ...body,
        page_url,
        referrer,
        user_agent
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}