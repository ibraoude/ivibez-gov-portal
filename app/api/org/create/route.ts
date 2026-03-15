import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";
import { NextRequest } from "next/server";
import { Database } from "@/types/database";

type OrgInsert = Database["public"]["Tables"]["organizations"]["Insert"];

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

      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("name", orgName)
        .eq("created_by", user.id)
        .maybeSingle();

      if (existing) {
        throw new Error("You already created an organization with this name");
      }

      const orgPayload: OrgInsert = {
        name: orgName,
        created_by: user.id,
        email: "",
        city: "",
        country: "",
      };

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert(orgPayload)
        .select()
        .single();

      if (orgError || !org) {
        throw new Error(orgError?.message || "Failed to create organization");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          org_id: org.id,
          company: org.name,
          role: "client",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

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