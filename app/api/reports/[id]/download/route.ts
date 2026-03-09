
// app/api/reports/[id]/download/route.ts
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";

/** Convert an array of homogeneous objects to CSV (UTF‑8, quoted, header row). */
function toCSV(rows: any[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";

  // Build a stable union of keys across all rows
  const headerSet = new Set<string>();
  for (const r of rows) {
    if (r && typeof r === "object" && !Array.isArray(r)) {
      Object.keys(r).forEach((k) => headerSet.add(k));
    }
  }
  const headers = Array.from(headerSet);

  const escapeCell = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/"/g, '""')}"`;

  const headerLine = headers.map(escapeCell).join(",");
  const lines = rows.map((row) =>
    headers
      .map((h) => {
        const val = (row ?? {})[h];
        // Stringify objects/arrays for CSV
        if (val && typeof val === "object") return escapeCell(JSON.stringify(val));
        return escapeCell(val);
      })
      .join(",")
  );

  return [headerLine, ...lines].join("\n");
}

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return secureRoute(
    req,
    {
      requireCaptcha: false,            // internal download; no captcha by default
      requireOrg: true,                 // must belong to an org
      requiredRoles: [],                // allow any org role; change to ["admin","manager","auditor"] if desired
      logCaptcha: false,
    },
    async ({ supabase, profile, user }) => {
      const reportId = params.id;
      if (!reportId) {
        return NextResponse.json({ error: "Missing report id" }, { status: 400 });
      }

      // Narrow org_id (string | null -> string)
      if (!profile.org_id) {
        return NextResponse.json({ error: "User not attached to organization" }, { status: 403 });
      }
      const orgId = profile.org_id;

      const url = new URL(req.url);
      const format = (url.searchParams.get("format") || "json").toLowerCase();

      // Fetch the report with org isolation
      const { data: report, error: fetchErr } = await supabase
        .from("reports")
        .select("id, report_type, contract_count, status, checksum, approved_at, approved_by, created_at, snapshot, org_id")
        .eq("id", reportId)
        .eq("org_id", orgId)
        .single();

      if (fetchErr || !report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      if (report.status !== "locked") {
        return NextResponse.json({ error: "Report must be locked before download" }, { status: 409 });
      }

      // Build response body
      let body: string;
      let contentType: string;
      let fileExt: string;

      if (format === "csv") {
        // Snapshot is expected to be an array of row objects; if it isn't, wrap it.
        const rows = Array.isArray(report.snapshot) ? report.snapshot : [report.snapshot ?? {}];
        body = toCSV(rows);
        contentType = "text/csv; charset=utf-8";
        fileExt = "csv";
      } else {
        // Default JSON: include the full report row (common for archiving)
        body = JSON.stringify(report, null, 2);
        contentType = "application/json; charset=utf-8";
        fileExt = "json";
      }

      // Non-blocking audit
      try {
        await logAudit({
          supabase,
          org_id: orgId,
          user_id: user.id,
          action: format === "csv" ? "report_downloaded_csv" : "report_downloaded_json",
          entity_type: "report",
          entity_id: reportId,
          metadata: {
            format,
            report_type: report.report_type,
            contract_count: report.contract_count,
            checksum: report.checksum,
          },
        });
      } catch {
        /* ignore audit failures */
      }

      const filename = `compliance-report-${report.id}.${fileExt}`;
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      });
    }
  );
}
