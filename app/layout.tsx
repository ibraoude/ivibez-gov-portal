
// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers"; // client providers (theme + motion)

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iVibeZ Solutions",
  description: "Secure Government Service Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load reCAPTCHA v3 once, globally */}
        {siteKey && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
            strategy="afterInteractive"
          />
        )}
      </head>

      {/* Global light/dark surfaces + font vars */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen
                    bg-gray-50 text-gray-900
                    dark:bg-black dark:text-gray-100`}
      >
        <Providers>
          <div className="min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
