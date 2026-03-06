import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";

export async function POST(req: Request) {
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

      const orgName = body.orgName?.trim();
      if (!orgName) throw new Error("orgName required");

      const { data: org } = await supabase
        .from("organizations")
        .insert({ name: orgName, created_by: user.id })
        .select()
        .single();

      await supabase
        .from("profiles")
        .update({ org_id: org.id, role: "owner" })
        .eq("id", user.id);

      await logAudit({
        supabase,
        org_id: org.id,
        user_id: user.id,
        action: "org_created",
        entity_type: "organization",
        entity_id: org.id,
        metadata: { captcha_score: captcha.score },
      });

      return { success: true, org_id: org.id };
    }
  );
}