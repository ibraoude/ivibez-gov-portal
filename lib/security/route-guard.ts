export type RecaptchaVerifyResult = {
  ok: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  expectedAction?: string; 
  success?: boolean;     
  errorCodes?: string[];
};

export async function verifyRecaptchaV3(opts: {
  token: string;
  expectedAction: string;
  remoteip?: string;
}): Promise<RecaptchaVerifyResult> {

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return {
      ok: false,
      expectedAction: opts.expectedAction,
      errorCodes: ["missing-secret"],
    };
  }

  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", opts.token);
  if (opts.remoteip) form.append("remoteip", opts.remoteip);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const data = await res.json();

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");

  const actionMatches = data?.action === opts.expectedAction;
  const scoreValid = typeof data?.score === "number" && data.score >= minScore;

  const ok =
    data?.success === true &&
    actionMatches &&
    scoreValid;

  return {
    ok,
    success: data?.success === true,        
    score: data?.score,
    action: data?.action,
    hostname: data?.hostname,
    expectedAction: opts.expectedAction,
    errorCodes: data?.["error-codes"],
  };
}