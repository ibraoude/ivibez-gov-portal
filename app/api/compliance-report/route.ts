
import {NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { secureRoute } from "@/lib/security/secure-route";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return secureRoute(
    req,
    {
      requireCaptcha: false,                            // captcha disabled
      requireOrg: true,                                 // user must belong to an org
      requiredRoles: ["admin", "manager", "auditor"],   // adjust if needed
      logCaptcha: false,
    },
    async ({ supabase, profile, user, body }) => {
      // ---- guard org for TS & safety ----
      if (!profile.org_id) {
        return NextResponse.json(
          { error: "User not attached to organization" },
          { status: 403 }
        );
      }
      const orgId: string = profile.org_id;

      // ---- input ----
      const includeSnapshot: boolean =
        typeof body?.includeSnapshot === "boolean" ? body.includeSnapshot : true;

      // ---- 1) Count contracts (HEAD + count) ----
      const { count, error: countErr } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      if (countErr) {
        return NextResponse.json({ error: countErr.message }, { status: 400 });
      }

      // ---- 2) Optional snapshot (full rows) ----
      let snapshot: unknown = [];
      if (includeSnapshot) {
        const { data: contracts, error: contractsErr } = await supabase
          .from("contracts")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });

        if (contractsErr) {
          return NextResponse.json({ error: contractsErr.message }, { status: 400 });
        }
        snapshot = contracts ?? [];
      }

      // ---- 3) Optional checksum (best effort) ----
      let checksum: string | null = null;
      try {
        const { data: csum } = await supabase.rpc("report_checksum_sha256", {
          payload: snapshot as any, // server Json type
        });
        checksum = csum ?? null;
      } catch {
        // ignore checksum failures
      }

      // ---- 4) Insert report (typed) ----
      const insertPayload: Database["public"]["Tables"]["reports"]["Insert"] = {
        org_id: orgId,
        generated_by: user.id,
        report_type: "portfolio_snapshot",
        snapshot: (snapshot as unknown) as Database["public"]["Tables"]["reports"]["Insert"]["snapshot"],
        contract_count: count ?? 0,
        status: "draft",
        checksum: checksum ?? undefined,
      };

      const { data: report, error: reportErr } = await supabase
        .from("reports")
        .insert(insertPayload)
        .select("*")
        .single();

      if (reportErr) {
        return NextResponse.json({ error: reportErr.message }, { status: 400 });
      }

      // ---- 5) Response ----
      return NextResponse.json({
        success: true,
        contract_count: count ?? 0,
        report_id: report.id,
        report_status: report.status,
      });
    }
  );
}
