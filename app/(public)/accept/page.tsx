
// app/(public)/accept/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    token?: string;
    returnTo?: string; // (optional) if someone links back to here explicitly
  };
};

export default function AcceptInvitePage({ searchParams }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const token = (searchParams?.token ?? "").trim();

  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Accepting invitation...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing invitation token.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();

        // Not signed in? Send to login and then return BACK to *this* page: /accept
        if (!data.session) {

          const params = new URLSearchParams({ returnTo: `/accept?token=${token}` });
          router.push(`/login?${params.toString()}`);

          return;
        }

        const accessToken = data.session.access_token;

        const res = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Request-ID": crypto.randomUUID(),
          },
          body: JSON.stringify({ token }),
        });

        // Read as text first; then try JSON to avoid "Unexpected end of JSON input"
        const bodyText = await res.text();
        const json = safeParseJSON(bodyText);

        if (!res.ok) {
          if (!cancelled) {
            setStatus("error");
            setMessage(
              (json && typeof json === "object" && "error" in json
                ? String((json as Record<string, unknown>).error)
                : null) || "Failed to accept invitation."
            );
          }
          return;
        }

        if (!cancelled) {
          setStatus("ok");
          setMessage("Invitation accepted! Redirecting...");
          setTimeout(() => {
            // If a returnTo is present, honor it; otherwise go to dashboard.
            const sp = new URLSearchParams(window.location.search);
            const next = sp.get("returnTo");
            router.push(next || "/dashboard");
          }, 1000);
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Something went wrong.";
          setStatus("error");
          setMessage(msg);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, router, supabase]);

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-lg border bg-white p-6 shadow">
        <h1
          className={`mb-3 text-center text-lg font-semibold ${
            status === "ok"
              ? "text-emerald-700"
              : status === "error"
              ? "text-rose-700"
              : "text-blue-700"
          }`}
        >
          {status === "ok" ? "Success" : status === "error" ? "Error" : "Accept Invitation"}
        </h1>

        <p className="text-center text-sm text-gray-700">{message}</p>
      </div>
    </main>
  );
}

/** Safe JSON parse helper (returns null on empty/invalid) */
function safeParseJSON(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
