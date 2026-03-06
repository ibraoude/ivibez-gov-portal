
import { NextResponse } from 'next/server';
import { secureRoute } from '@/lib/security/secure-route';
import { logAudit } from '@/lib/audit/log-audit';

export const runtime = 'nodejs';

function extractId(req: Request, params?: { id?: string }) {
  if (params?.id) return params.id;
  try {
    const parts = new URL(req.url).pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'invitations');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {}
  return null;
}

  export async function POST(
    req: Request,
    { params }: { params: { id: string } }
  ) {
  return secureRoute(
    req,
    {
      requireCaptcha: false,
      requireOrg: true,
      requiredRoles: ['owner', 'admin', 'manager'],
      logCaptcha: false,
    },
    async ({ supabase, profile, user }) => {
      const id = extractId(req, params);
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      if (!profile.org_id) return NextResponse.json({ error: 'No org' }, { status: 403 });

      // Load invitation within org
      const { data: inv, error: fetchErr } = await supabase
        .from('invitations')
        .select('id, accepted_at, revoked_at')
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .single();

      if (fetchErr || !inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (inv.accepted_at) return NextResponse.json({ error: 'Already accepted' }, { status: 409 });
      if (inv.revoked_at) return NextResponse.json({ error: 'Already revoked' }, { status: 409 });

      const now = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('invitations')
        .update({
          revoked_at: now,
          token: null, // make link unusable
        })
        .eq('id', id)
        .eq('org_id', profile.org_id);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

      try {
        await logAudit({
          supabase,
          org_id: profile.org_id,
          user_id: user.id,
          action: 'invite_revoked',
          entity_type: 'invitation',
          entity_id: id,
        });
      } catch {}

      return NextResponse.json({ ok: true });
    }
  );
}
``
