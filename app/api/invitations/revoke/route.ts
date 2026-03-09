//app/api/invitations/revoke/route.ts
import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type SecureContext = {
  supabase: SupabaseClient;
  user: {
    id: string;
  };
  profile: {
    role: string | null;
    org_id: string | null;
  };
  body: any;
  captcha?: {
    score?: number;
  };
};

export async function POST(req: NextRequest) {
  return secureRoute(
    req,
    {
      expectedAction: "invite_revoke",
      minScore: 0.7,
      requiredRoles: [],   // handled manually
      requireOrg: false,
      logCaptcha: true,
    },
    async (ctx: SecureContext) => {

      const { supabase, user, profile, body, captcha } = ctx;

      const inviteId = String(body?.inviteId || "").trim();

      if (!inviteId) {
        throw new Error("Invite ID required");
      }

      /* ===============================
         🔐 CHECK PLATFORM ADMIN
      =============================== */

      const { data: platformAdmin } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const isSuperAdmin = !!platformAdmin;

      /* ===============================
         🔍 FETCH INVITE
      =============================== */

      const { data: invite, error: fetchErr } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", inviteId)
        .single();

      if (fetchErr || !invite) {
        throw new Error("Invitation not found");
      }

      /* ===============================
         🔐 AUTHORIZATION LOGIC
      =============================== */

      if (!isSuperAdmin) {

        if (!profile.org_id) {
          throw new Error("User not attached to organization");
        }

        const userRole = profile.role ?? "";

        if (!["owner", "admin", "manager"].includes(userRole)) {
          throw new Error("Insufficient role privileges");
        }

        if (invite.org_id !== profile.org_id) {
          throw new Error("Unauthorized organization access");
        }
      }

      /* ===============================
         🔐 Cannot revoke accepted invite
      =============================== */

      if (invite.accepted_at) {
        throw new Error("Cannot revoke accepted invitation");
      }

      /* ===============================
         🗑 DELETE INVITE
      =============================== */

      const { error: deleteErr } = await supabase
        .from("invitations")
        .delete()
        .eq("id", inviteId)
        .limit(1);

      if (deleteErr) {
        throw deleteErr;
      }

      /* ===============================
         🧾 AUDIT LOG
      =============================== */

      await logAudit({
        supabase,
        org_id: invite.org_id,
        user_id: user.id,
        action: "invite_revoked",
        entity_type: "invitation",
        entity_id: inviteId,
        metadata: {
          email: invite.email,
          role: invite.role,
          revoked_by_super_admin: isSuperAdmin,
          captcha_score: captcha?.score ?? null,
        },
      });

      return { success: true };
    }
  );
}