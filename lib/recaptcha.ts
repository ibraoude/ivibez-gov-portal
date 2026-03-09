declare global {
  interface Window {
    grecaptcha?: {
      ready(cb: () => void): void;
      execute(siteKey: string, opts: { action: string }): Promise<string>;
    };
  }
}

export async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    throw new Error("Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
  }

  if (typeof window === "undefined") {
    throw new Error("reCAPTCHA cannot run on the server");
  }

  await new Promise<void>((resolve) => {
    const check = () => {
      if (window.grecaptcha) resolve();
      else setTimeout(check, 50);
    };
    check();
  });

  const grecaptcha = window.grecaptcha!;

  await new Promise<void>((resolve) => grecaptcha.ready(() => resolve()));

  return grecaptcha.execute(siteKey, { action });
}