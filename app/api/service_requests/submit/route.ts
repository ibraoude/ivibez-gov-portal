import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";

export async function POST(req: Request) {
  return secureRoute(
    req,
    {
      expectedAction: "service_request_submit",
      requiredRoles: ["viewer", "officer", "admin", "owner"],
      logCaptcha: true,
    },
    async ({ user, profile, supabase, body, captcha }) => {

      // 🔎 Ensure user belongs to org
      if (!profile.org_id) {
        throw new Error("User not assigned to organization");
      }

      const {
        govType,
        title,
        description,
        formData,
      } = body;

      if (!govType || !title) {
        throw new Error("Missing required fields");
      }

      // 🔐 Server-controlled insert (NOT client controlled)
      const { data: request, error } = await supabase
        .from("service_requests")
        .insert({
          org_id: profile.org_id,
          submitted_by: user.id,
          requester_email: user.email,
          gov_type: govType,
          title,
          description: description ?? null,
          form_data: formData ?? null,
          status: "pending",
          admin_status: "submitted",
          awarded: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // 🧾 Audit Log
      await logAudit({
        supabase,
        org_id: profile.org_id,
        user_id: user.id,
        action: "service_request_submitted",
        entity_type: "service_request",
        entity_id: request.id,
        metadata: {
          gov_type: govType,
          captcha_score: captcha.score,
        },
      });

      return {
        success: true,
        request,
      };
    }
  );
}