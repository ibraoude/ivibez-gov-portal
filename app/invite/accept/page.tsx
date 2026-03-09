'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRecaptchaToken } from '@/lib/security/recaptcha-client';

type Status = 'loading' | 'success' | 'error';

type AcceptInviteResponse = {
  success?: boolean;
  error?: string;
};

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const inviteToken = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!inviteToken) {
      setStatus('error');
      setMessage('Invalid invitation link.');
      return;
    }

    const acceptInvitation = async () => {
      try {
        /* ===============================
           CHECK USER SESSION
        =============================== */

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData.session;

        if (!session) {
          router.push(`/signup?inviteToken=${inviteToken}`);
          return;
        }

        /* ===============================
           GET RECAPTCHA TOKEN
        =============================== */

        const captchaToken = await getRecaptchaToken('invite_accept');

        /* ===============================
           CALL ACCEPT INVITE API
        =============================== */

        const response = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            inviteToken,
            recaptchaToken: captchaToken,
          }),
        });

        const result: AcceptInviteResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to accept invitation.');
        }

        /* ===============================
           SUCCESS
        =============================== */

        setStatus('success');
        setMessage('Invitation accepted successfully.');

        // Optional redirect after success
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);

      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'Unexpected error occurred while accepting the invitation.';

        setStatus('error');
        setMessage(msg);
      }
    };

    acceptInvitation();
  }, [inviteToken, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">

        {status === 'loading' && (
          <p className="text-gray-600">Processing invitation...</p>
        )}

        {status === 'success' && (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-green-600">
              Success
            </h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-red-600">
              Error
            </h2>
            <p>{message}</p>
          </div>
        )}

      </div>
    </div>
  );
}