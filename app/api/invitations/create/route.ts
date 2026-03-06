import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";
import { Resend } from "resend";
import crypto from "crypto";

export async function POST(req: Request) {
  return secureRoute(
    req,
    {
      expectedAction: "invite_create",
      // 👇 Remove strict org + role enforcement here
      requiredRoles: [],
      requireOrg: false,
      logCaptcha: true,
    },
    async ({ supabase, user, profile, body, captcha }) => {

      const email = String(body?.email || "").trim().toLowerCase();
      const role = String(body?.role || "viewer");
      const requestedOrgId = body?.org_id || null;

      if (!email) throw new Error("Email required");

      /* ===============================
         🔐 CHECK IF PLATFORM ADMIN
      =============================== */

      const { data: platformAdmin } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const isSuperAdmin = !!platformAdmin;

      /* ===============================
         🔐 ORG RESOLUTION LOGIC
      =============================== */

      let orgId: string | null = null;

      if (isSuperAdmin) {
        // Super admin can invite to any org (must provide org_id)
        if (!requestedOrgId)
          throw new Error("org_id required for super_admin");

        orgId = requestedOrgId;
      } else {
        // Regular org role enforcement
        if (!profile.org_id)
          throw new Error("User not attached to organization");

        if (!["owner", "admin", "manager"].includes(profile.role))
          throw new Error("Insufficient role privileges");

        orgId = profile.org_id;
      }

      /* ===============================
         1️⃣ INSERT INVITATION RECORD
      =============================== */

      const token = crypto.randomBytes(32).toString("hex");

      const { data: invite, error } = await supabase
        .from("invitations")
        .insert({
          org_id: orgId,
          email,
          role,
          token,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      /* ===============================
         2️⃣ SEND EMAIL
      =============================== */

      const resend = new Resend(process.env.RESEND_API_KEY!);
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${token}`;
      

      try {
        await resend.emails.send({
          from: "Compliance Portal <no-reply@ivibezsolutions.com>",
          to: email,
          subject: "You’ve been invited to join the Compliance Platform",
          html: `
            <div style="font-family: Arial; padding: 30px;">
              <h2>You’ve been invited</h2>
              <p>You have been invited to join your organization.</p>

              <a href="${inviteUrl}"
                 style="display:inline-block;padding:12px 24px;background:#1e40af;color:white;text-decoration:none;border-radius:6px;">
                 Accept Invitation
              </a>

              <p style="margin-top:20px;font-size:12px;color:#666;">
                This link expires in 7 days.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email failed:", emailError);
      }
      

      /* ===============================
         3️⃣ AUDIT LOG
      =============================== */

      await logAudit({
        supabase,
        org_id: orgId,
        user_id: user.id,
        action: "invite_created",
        entity_type: "invitation",
        entity_id: invite.id,
        metadata: {
          email,
          role,
          created_by_super_admin: isSuperAdmin,
          captcha_score: captcha.score,
        },
      });

      return { success: true };
    }
  );
}