
// lib/recaptcha.ts
export async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) throw new Error("Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY");

  if (typeof window === "undefined") {
    throw new Error("reCAPTCHA cannot run on the server");
  }

  // Wait until the script is present
  if (!window.grecaptcha) {
    await new Promise<void>((resolve) => {
      const check = () => (window.grecaptcha ? resolve() : setTimeout(check, 50));
      check();
    });
  }

  // Wait until reCAPTCHA is internally ready
  await new Promise<void>((resolve) => window.grecaptcha!.ready(() => resolve()));

  // Execute v3 action
  return window.grecaptcha!.execute(siteKey, { action });
}
