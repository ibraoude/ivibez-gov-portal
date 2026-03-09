import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  return secureRoute(
    req,
    {
      expectedAction: "service_request_submit",
      requiredRoles: ["viewer", "officer", "admin", "owner"],
      logCaptcha: true,
    },
    async ({ user, profile, supabase, body, captcha }) => {

      /* ===============================
         ORG VALIDATION
      =============================== */

      if (!profile?.org_id) {
        throw new Error("User not assigned to organization");
      }

      /* ===============================
         BODY SAFE PARSING
      =============================== */

      const govType = String(body?.govType || "").trim();
      const title = String(body?.title || "").trim();
      const description = body?.description ?? null;
      const formData = body?.formData ?? null;

      if (!govType || !title) {
        throw new Error("Missing required fields");
      }

      /* ===============================
         INSERT SERVICE REQUEST
      =============================== */

      const { data: request, error } = await supabase
        .from("service_requests")
        .insert({
          org_id: profile.org_id,
          submitted_by: user.id,
          requester_email: user.email ?? null,
          gov_type: govType,
          title,
          description,
          form_data: formData,
          status: "pending",
          admin_status: "submitted",
          awarded: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !request) {
        throw new Error(error?.message || "Failed to create service request");
      }

      /* ===============================
         AUDIT LOG
      =============================== */

      await logAudit({
        supabase,
        org_id: profile.org_id,
        user_id: user.id,
        action: "service_request_submitted",
        entity_type: "service_request",
        entity_id: request.id,
        metadata: {
          gov_type: govType,
          captcha_score: captcha?.score ?? null,
        },
      });

      return {
        success: true,
        request,
      };
    }
  );
}