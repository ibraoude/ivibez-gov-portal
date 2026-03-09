
// app/(public)/login/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({
  inviteToken,
  defaultReturnTo,
}: {
  inviteToken?: string;
  defaultReturnTo: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const normalized = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });

    if (error) {
      setError(error.message); // generic "Invalid login credentials"
      setSubmitting(false);
      return;
    }
    const nextUrl = inviteToken
      ? `/invite/accept?token=${encodeURIComponent(inviteToken)}`
      : defaultReturnTo;

    router.replace(nextUrl);
  }

  async function handleForgotPassword() {
    setError(null);
    setNotice(null);

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter your email first so we can send the reset link.");
      return;
    }

    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${window.location.origin}/auth/reset`, // <-- this page will handle the password update flow
    });

    if (error) setError(error.message);
    else setNotice("Check your email for the password reset link.");

    setResetting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white w-[420px] p-12 rounded-2xl shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="flex items-baseline">
            <span className="text-6xl font-black text-green-700 tracking-tight">iVibeZ</span>
            <span className="ml-3 text-3xl font-bold text-blue-700 tracking-tight">Solutions</span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center mb-8">Login</h1>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border mb-4 rounded-lg"
            placeholder="Email"
            autoComplete="email"
          />

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border mb-4 rounded-lg"
            placeholder="Password"
            autoComplete="current-password"
          />

          {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
          {notice && <div className="mb-2 text-sm text-emerald-600">{notice}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Login"}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetting}
            className="w-full mt-2 border border-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-50 transition disabled:opacity-50"
          >
            {resetting ? "Sending reset link..." : "Forgot password?"}
          </button>
        </form>
      </div>
    </div>
  );
}
