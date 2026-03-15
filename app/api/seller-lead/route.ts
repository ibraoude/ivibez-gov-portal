export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase env variables");
      return Response.json({ success: false }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { captchaToken, ...lead } = body;

    const captchaVerify = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY! || "",
          response: captchaToken,
        }),
      }
    );

    const captcha = await captchaVerify.json();

    if (!captcha.success || captcha.score < 0.5) {
      return Response.json({ success: false, error: "captcha_failed" });
    }

    const { error } = await supabase
      .from("seller_leads")
      .insert([lead]);

    if (error) {
      console.error(error);
      return Response.json({ success: false, error: "insert_failed" });
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error(err);
    return Response.json({ success: false }, { status: 500 });
  }
}