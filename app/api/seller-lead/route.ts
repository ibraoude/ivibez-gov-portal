import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: Request) {

  const body = await req.json();

  const { captchaToken, ...lead } = body;

  const captchaVerify = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded"
      },
      body:`secret=${process.env.RECAPTCHA_SECRET}&response=${captchaToken}`
    }
  );

  const captcha = await captchaVerify.json();

  if(!captcha.success || captcha.score < 0.5){
    return Response.json({ success:false });
  }

  const { error } = await supabase
    .from("seller_leads")
    .insert([lead]);

  if(error){
    return Response.json({ success:false });
  }

  return Response.json({ success:true });
}