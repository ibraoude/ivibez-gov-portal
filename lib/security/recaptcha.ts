
// lib/security/recaptcha.ts

export type RecaptchaVerifyResult = {
  ok: boolean;

  // Google response
  success?: boolean;
  score?: number;
  action?: string;
  hostname?: string;

  // Validation context
  expectedAction?: string;
  actionMatches?: boolean;
  scoreValid?: boolean;

  errorCodes?: string[];
};

type VerifyOptions = {
  token: string;
  /** If omitted, action matching is skipped (treated as true). */
  expectedAction?: string;
  remoteip?: string;
  /** Optional override for min-score; falls back to env or 0.5 */
  minScore?: number;
  /** Abort after X ms (default 5000) */
  timeoutMs?: number;
};

export async function verifyRecaptchaV3(opts: VerifyOptions): Promise<RecaptchaVerifyResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const minScoreEnv = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  const minScore = typeof opts.minScore === "number" ? opts.minScore : minScoreEnv;
  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 5000;

  if (!secret) {
    return {
      ok: false,
      success: false,
      expectedAction: opts.expectedAction,
      actionMatches: typeof opts.expectedAction === "string" ? false : undefined,
      scoreValid: false,
      errorCodes: ["missing-secret"],
    };
  }

  // Build form body
  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", opts.token);
  if (opts.remoteip) form.append("remoteip", opts.remoteip);

  // Abortable fetch to avoid hanging the route
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let data: any = null;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Gracefully handle non-2xx
    if (!res.ok) {
      return {
        ok: false,
        success: false,
        expectedAction: opts.expectedAction,
        errorCodes: [`http-${res.status}`],
      };
    }

    data = await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    // network / timeout / abort
    return {
      ok: false,
      success: false,
      expectedAction: opts.expectedAction,
      errorCodes: [err?.name === "AbortError" ? "timeout" : "network-error"],
    };
  }

  // Normalize fields from Google
  const success = data?.success === true;
  const score = typeof data?.score === "number" ? data.score : undefined;
  const action = typeof data?.action === "string" ? data.action : undefined;
  const hostname = typeof data?.hostname === "string" ? data.hostname : undefined;
  const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"] : undefined;

  // Validation
  const scoreValid = typeof score === "number" ? score >= minScore : false;

  // If expectedAction is provided, enforce match; else treat as passed
  const hasExpected = typeof opts.expectedAction === "string" && opts.expectedAction.length > 0;
  const actionMatches = hasExpected ? action === opts.expectedAction : true;

  const ok = success && actionMatches && scoreValid;

  return {
    ok,
    success,
    score,
    action,
    hostname,
    expectedAction: opts.expectedAction,
    actionMatches,
    scoreValid,
    errorCodes: codes,
  };
}
