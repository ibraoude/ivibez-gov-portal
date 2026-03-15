
// app/api/reports/[id]/approve/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IdRouteContext } from "@/lib/types/route-context";
import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";

export const runtime = "nodejs";

/** Helper to recover id if `params` is missing/misbound */
function extractId(req: NextRequest, params?: { id?: string }) {
  if (params?.id && typeof params.id === "string") return params.id;
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "reports");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {}
  return null;
}

export async function POST(
  req: NextRequest,
  context: IdRouteContext
) {
  const params = await context.params;

  return secureRoute(
    req,
    {
      requireCaptcha: false,
      requireOrg: true,
      requiredRoles: ["admin", "manager"],
      logCaptcha: false,
    },
    async ({ user, profile, supabase }) => {
      const reportId = extractId(req, params);

      if (!reportId) {
        return NextResponse.json({ error: "Missing report id" }, { status: 400 });
      }

      if (!profile.org_id) {
        return NextResponse.json(
          { error: "User not attached to organization" },
          { status: 403 }
        );
      }

      const orgId = profile.org_id;

      const { data: report, error: fetchErr } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 400 });
      }

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      if (report.status !== "draft") {
        return NextResponse.json(
          { error: "Only draft reports can be approved" },
          { status: 409 }
        );
      }

      const { data: checksumVal, error: checksumErr } = await supabase.rpc(
        "report_checksum_sha256",
        { payload: report.snapshot }
      );

      if (checksumErr) {
        return NextResponse.json({ error: checksumErr.message }, { status: 400 });
      }

      const now = new Date().toISOString();

      const { data: updated, error: updErr } = await supabase
        .from("reports")
        .update({
          status: "locked",
          approved_by: user.id,
          approved_at: now,
          locked_at: now,
          checksum: checksumVal ?? null,
        })
        .eq("id", reportId)
        .eq("org_id", orgId)
        .select("*")
        .single();

      if (updErr || !updated) {
        return NextResponse.json(
          { error: updErr?.message || "Update failed" },
          { status: 400 }
        );
      }

      try {
        await logAudit({
          supabase,
          org_id: orgId,
          user_id: user.id,
          action: "report_approved",
          entity_type: "report",
          entity_id: reportId,
          metadata: {
            report_type: updated.report_type,
            contract_count: updated.contract_count,
            checksum: updated.checksum,
          },
        });
      } catch {}

      return NextResponse.json(
        { success: true, report: updated },
        { status: 200 }
      );
    }
  );
}