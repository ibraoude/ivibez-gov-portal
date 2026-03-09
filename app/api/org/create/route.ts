import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  return secureRoute(
    req,
    {
      expectedAction: "org_create",
      minScore: 0.7,
      requireOrg: false,
      requiredRoles: [],
      logCaptcha: true,
    },
    async ({ user, supabase, body, captcha }) => {

      const orgName = String(body?.orgName || "").trim();

      if (!orgName) {
        throw new Error("orgName required");
      }

      /* ===============================
         CREATE ORGANIZATION
      =============================== */

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          created_by: user.id,
        })
        .select()
        .single();

      if (orgError || !org) {
        throw new Error(orgError?.message || "Failed to create organization");
      }

      /* ===============================
         ATTACH USER AS OWNER
      =============================== */

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          org_id: org.id,
          role: "owner",
        })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      /* ===============================
         AUDIT LOG
      =============================== */

      await logAudit({
        supabase,
        org_id: org.id,
        user_id: user.id,
        action: "org_created",
        entity_type: "organization",
        entity_id: org.id,
        metadata: {
          captcha_score: captcha?.score ?? null,
        },
      });

      return {
        success: true,
        org_id: org.id,
      };
    }
  );
}