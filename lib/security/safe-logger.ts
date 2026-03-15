const SECRET_PATTERNS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "RECAPTCHA_SECRET_KEY",
  "JWT_SECRET",
  "API_KEY",
  "TOKEN",
];

function sanitize(value: any) {
  if (typeof value !== "string") return value;

  for (const key of SECRET_PATTERNS) {
    if (value.includes(key)) {
      return "[REDACTED_SECRET]";
    }
  }

  return value;
}

export const safeLog = (...args: any[]) => {
  const sanitized = args.map((a) => {
    if (typeof a === "object") {
      const copy: Record<string, any> = {};

      for (const k in a) {
        if (SECRET_PATTERNS.some((s) => k.toUpperCase().includes(s))) {
          copy[k] = "[REDACTED_SECRET]";
        } else {
          copy[k] = a[k];
        }
      }

      return copy;
    }

    return sanitize(a);
  });

  console.log(...sanitized);
};