"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    token?: string;
  };
};

export default function AcceptInvitePage({ searchParams }: Props) {
  const router = useRouter();

  const token = (searchParams?.token ?? "").trim();

  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Accepting invitation...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing invitation token.");
      return;
    }

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          const next = encodeURIComponent(`/invite/accept?token=${encodeURIComponent(token)}`);
          router.push(`/login?next=${next}`);
          return;
        }

        // 🔥 Guaranteed correct URL
        const res = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setStatus("error");
          setMessage(json.error || "Failed to accept invitation.");
          return;
        }

        setStatus("ok");
        setMessage("Invitation accepted! Redirecting...");

        setTimeout(() => router.push("/dashboard"), 1000);

      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message || "Something went wrong.");
      }
    }

    run();
  }, [token, router]);

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
          {status === "ok"
            ? "Success"
            : status === "error"
            ? "Error"
            : "Accept Invitation"}
        </h1>

        <p className="text-center text-sm text-gray-700">
          {message}
        </p>
      </div>
    </main>
  );
}