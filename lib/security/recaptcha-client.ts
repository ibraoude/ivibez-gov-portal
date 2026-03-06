
// lib/security/recaptcha-client.ts

// Ambient type for the global script (single source of truth)
declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

// Prevent duplicate script injection across calls
let recaptchaLoadingPromise: Promise<void> | null = null;

/** Dynamically load reCAPTCHA v3 if it's not already present */
async function loadRecaptchaIfNeeded(siteKey: string): Promise<void> {
  if (typeof window === "undefined") return; // SSR no-op

  // Already available
  if (window.grecaptcha) return;

  // Already loading
  if (recaptchaLoadingPromise) {
    await recaptchaLoadingPromise;
    return;
  }

  recaptchaLoadingPromise = new Promise<void>((resolve, reject) => {
    // If a script tag exists, assume it will resolve soon
    const existing = document.querySelector(`script[src*="recaptcha/api.js"]`);
    if (existing) {
      // Wait a tick for grecaptcha to initialize if needed
      const checkReady = () =>
        (window.grecaptcha ? resolve() : setTimeout(checkReady, 50));
      checkReady();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA v3 script"));
    document.head.appendChild(script);
  });

  await recaptchaLoadingPromise;
}

/**
 * Get a reCAPTCHA v3 token for a given action.
 * Reads the site key from NEXT_PUBLIC_RECAPTCHA_SITE_KEY (client-side only).
 *
 * Usage:
 *   const token = await getRecaptchaToken("contract_create");
 *   // send token to your API (secure-route will verify it server-side)
 */
export async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) throw new Error("Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
  if (typeof window === "undefined") throw new Error("reCAPTCHA cannot run on the server");

  // Ensure the script is present
  await loadRecaptchaIfNeeded(siteKey);

  // Wait for grecaptcha to be initialized
  await new Promise<void>((resolve) => {
    const ensureReady = () =>
      (window.grecaptcha ? window.grecaptcha.ready(() => resolve()) : setTimeout(ensureReady, 50));
    ensureReady();
  });

  // Execute and return token
  const token = await window.grecaptcha!.execute(siteKey, { action });
  if (!token) throw new Error("Failed to generate reCAPTCHA token");
  return token;
}
