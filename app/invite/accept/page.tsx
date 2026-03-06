'use client';

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getRecaptchaToken } from "@/lib/security/recaptcha-client";
import { useRouter } from "next/navigation";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const acceptInvite = async () => {
      try {
        if (!token) {
          setStatus("error");
          setMessage("Invalid invitation link.");
          return;
        }

        const {
          
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push(`/signup?inviteToken=${token}`);
          return;
        }

        const recaptchaToken = await getRecaptchaToken(
          process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!,
          "invite_accept"
        );

        const res = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            inviteToken: token,
            recaptchaToken,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to accept invitation");
        }

        setStatus("success");
        setMessage("Invitation accepted successfully!");

      } catch (err: any) {
        setStatus("error");
        setMessage(err.message);
      }
    };

    acceptInvite();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">

        {status === "loading" && (
          <p>Processing invitation...</p>
        )}

        {status === "success" && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Success</h2>
            <p>{message}</p>
          </div>
        )}

        {status === "error" && (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-red-600">Error</h2>
            <p>{message}</p>
          </div>
        )}

      </div>
    </div>
  );
}