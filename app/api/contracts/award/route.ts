import { NextRequest, NextResponse } from "next/server";
import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return secureRoute(
    req,
    {
      requireCaptcha: false,
      requireOrg: true,
      requiredRoles: ["admin", "owner", "super_admin"],
      logCaptcha: false,
    },
    async ({ user, profile, supabase, body }) => {

      // -------------------------------------------------------------------
      // 0) Validate org + requestId
      // -------------------------------------------------------------------

      const orgId = profile?.org_id;

      if (!orgId) {
        return NextResponse.json(
          { error: "Organization required" },
          { status: 400 }
        );
      }

      const { requestId } = body ?? {};

      if (!requestId || typeof requestId !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid requestId" },
          { status: 400 }
        );
      }

      // -------------------------------------------------------------------
      // 1) Fetch service request
      // -------------------------------------------------------------------

      const { data: request, error: reqErr } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", requestId)
        .eq("org_id", orgId)
        .single();

      if (reqErr || !request) {
        return NextResponse.json(
          { error: "Request not found or not accessible" },
          { status: 404 }
        );
      }

      // -------------------------------------------------------------------
      // 2) Already awarded (idempotent)
      // -------------------------------------------------------------------

      if (request.awarded === true) {
        const { data: existingContract } = await supabase
          .from("contracts")
          .select("id, contract_number")
          .eq("source_request_id", requestId)
          .eq("org_id", orgId)
          .maybeSingle();

        return NextResponse.json({
          success: true,
          alreadyAwarded: true,
          contract_id: existingContract?.id ?? null,
          contract_number: existingContract?.contract_number ?? null,
        });
      }

      // -------------------------------------------------------------------
      // 3) Ensure no duplicate contract
      // -------------------------------------------------------------------

      const { data: existing } = await supabase
        .from("contracts")
        .select("id, contract_number")
        .eq("source_request_id", requestId)
        .eq("org_id", orgId)
        .maybeSingle();

      let contractId: string | null = existing?.id ?? null;
      let contractNumber: string | null = existing?.contract_number ?? null;

      if (!existing) {
        const year = new Date().getFullYear();
        const random = Math.floor(1000 + Math.random() * 9000);

        const generatedNumber =
          `${(request.gov_type ?? "CON").toUpperCase()}-${year}-${random}`;

        const { data: newContract, error: insertErr } = await supabase
          .from("contracts")
          .insert({
            org_id: orgId,
            contract_number: generatedNumber,
            tracking_id: request.tracking_id ?? "",
            source_request_id: request.id,
            source_type: "request",
            owner_id: request.submitted_by ?? user.id,
            gov_type: request.gov_type ?? "CON",
            title: request.title ?? "",
            description: request.description ?? "",
            status: "active",
            progress_percentage: 0,
            awarded_by: user.id,
            awarded_at: new Date().toISOString(),
          })
          .select("id, contract_number")
          .single();

        if (insertErr) {
          return NextResponse.json(
            { error: insertErr.message },
            { status: 400 }
          );
        }

        contractId = newContract.id;
        contractNumber = newContract.contract_number;
      }

      // -------------------------------------------------------------------
      // 4) Update service request lifecycle
      // -------------------------------------------------------------------

      const { error: updateErr } = await supabase
        .from("service_requests")
        .update({
          admin_status: "awarded",
          awarded: true,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("org_id", orgId);

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message },
          { status: 400 }
        );
      }

      // -------------------------------------------------------------------
      // 5) Optional timeline entry
      // -------------------------------------------------------------------

      try {
        await supabase.from("service_request_events").insert({
          request_id: requestId,
          stage: "awarded",
          note: "Awarded via API",
          actor_email: user.email,
          org_id: orgId,
        });
      } catch {
        // ignore if table/policy missing
      }

      // -------------------------------------------------------------------
      // 6) Audit log
      // -------------------------------------------------------------------

      try {
        await logAudit({
          supabase,
          org_id: orgId,
          user_id: user.id,
          action: "contract_awarded",
          entity_type: "contract",
          entity_id: contractId,
          metadata: {
            source_request_id: requestId,
            tracking_id: request.tracking_id,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        contract_id: contractId,
        contract_number: contractNumber,
      });
    }
  );
}