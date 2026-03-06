
import { NextResponse } from 'next/server';
import { secureRoute } from '@/lib/security/secure-route';
import { Resend } from 'resend';
import { logAudit } from '@/lib/audit/log-audit';

export const runtime = 'nodejs';

async function extractId(
  req: Request,
  params?: Promise<{ id?: string }>
) {
  // Await params if provided
  const resolvedParams = params ? await params : undefined;

  if (resolvedParams?.id) return resolvedParams.id;

  try {
    const parts = new URL(req.url)
      .pathname
      .split("/")
      .filter(Boolean);

    const idx = parts.findIndex((p) => p === "invitations");

    if (idx >= 0 && parts[idx + 1]) {
      return parts[idx + 1];
    }
  } catch {}

  return null;
}

export async function POST(req: Request,context: { params: Promise<{ id: string }> }) {
  return secureRoute(
    req,
    {
      requireCaptcha: false,
      requireOrg: false,
      requiredRoles: ['owner', 'admin', 'manager'],
      logCaptcha: false,
    },
    async ({ supabase, profile, user }) => {
      const id = await extractId(req, context.params);
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      if (!profile.org_id) return NextResponse.json({ error: 'No org' }, { status: 403 });

      // Load invitation within org
      const { data: inv, error } = await supabase
        .from('invitations')
        .select('id, email, token, expires_at, accepted_at, revoked_at, org_id')
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .single();

      if (error || !inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      // Only resend for pending/expired (not accepted/revoked)
      if (inv.accepted_at || inv.revoked_at) {
        return NextResponse.json({ error: 'Invitation not resendable' }, { status: 409 });
      }

      const resendKey = process.env.RESEND_API_KEY;
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      const inviteUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(inv.token || '')}`;

      if (resendKey && appUrl) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: 'Compliance Portal <no-reply@ivibezsolutions.com>',
            to: inv.email,
            subject: 'Invitation reminder',
            html: `
              <div style="font-family: Arial, Helvetica, sans-serif; padding: 24px;">
                <h2 style="margin: 0 0 12px;">Invitation Reminder</h2>
                <p style="margin: 0 0 16px;">Click the link below to accept your invitation.</p>
                ${inviteUrl}
                  Accept Invitation
                </a>
              </div>
            `,
          });
        } catch (e) {
          // soft-fail email send
          console.error('[invite:resend] email error', e);
        }
      }

      try {
        await logAudit({
          supabase,
          org_id: profile.org_id,
          user_id: user.id,
          action: 'invite_resent',
          entity_type: 'invitation',
          entity_id: id,
          metadata: { email: inv.email },
        });
      } catch {}

      return NextResponse.json({ ok: true });
    }
  );
}
``
