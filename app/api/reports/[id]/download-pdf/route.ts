
// app/api/reports/[id]/download-pdf/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IdRouteContext } from "@/lib/types/route-context";
import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// Helper to recover id if `params` is missing/misbound
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

function formatMoney(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString()}`;
}
function safeDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString();
}
function signPayload(payload: string) {
  const secret = process.env.REPORT_SIGNATURE_SECRET;
  if (!secret) throw new Error("Missing REPORT_SIGNATURE_SECRET env var");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
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
      requiredRoles: ["admin", "manager", "auditor"],
      logCaptcha: false,
    },
    async ({ supabase, profile, user }) => {
      const reportId = extractId(req, params);
      if (!reportId) {
        return NextResponse.json({ error: "Missing report id" }, { status: 400 });
      }
      if (!profile.org_id) {
        return NextResponse.json({ error: "User not attached to organization" }, { status: 403 });
      }
      const orgId = profile.org_id;

      const { data: report, error: fetchErr } = await supabase
        .from("reports")
        .select(
          "id, org_id, report_type, contract_count, status, checksum, approved_at, approved_by, created_at, snapshot"
        )
        .eq("id", reportId)
        .eq("org_id", orgId)
        .single();

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
      if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      if (report.status !== "locked") {
        return NextResponse.json({ error: "Report must be locked before download" }, { status: 409 });
      }

      // Approver email via profiles
      let approverEmail = "unknown-approver";
      if (report.approved_by) {
        const { data: approver } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", report.approved_by)
          .maybeSingle();
        approverEmail = approver?.email ?? String(report.approved_by);
      }

      const payload = JSON.stringify({
        report_id: report.id,
        org_id: report.org_id,
        report_type: report.report_type,
        contract_count: report.contract_count,
        checksum: report.checksum ?? "no-checksum",
        approved_at: report.approved_at ?? "no-approved-at",
        approved_by: approverEmail,
      });
      const signature = signPayload(payload);

      // PDF build
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      try {
        const logoPath = path.join(process.cwd(), "public", "logo.png");
        if (fs.existsSync(logoPath)) {
          const img = await pdfDoc.embedPng(fs.readFileSync(logoPath));
          const dims = img.scale(0.25);
          page.drawImage(img, { x: 40, y: height - 80, width: dims.width, height: dims.height });
        }
      } catch {}

      page.drawText("Compliance Report (Locked)", { x: 200, y: height - 50, size: 18, font: fontBold });
      page.drawLine({ start: { x: 40, y: height - 90 }, end: { x: width - 40, y: height - 90 }, thickness: 1 });
      page.drawText("CONFIDENTIAL", {
        x: 110, y: height / 2, size: 60, font: fontBold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(30), opacity: 0.4,
      });

      const lines = [
        `Report ID: ${report.id}`,
        `Type: ${String(report.report_type || "").replaceAll("_", " ")}`,
        `Contract Count: ${report.contract_count ?? "—"}`,
        `Approved By: ${approverEmail}`,
        `Approved At: ${safeDate(report.approved_at)}`,
        `Generated At: ${safeDate(report.created_at)}`,
        `Checksum (SHA-256): ${report.checksum ?? "—"}`,
        `Signature (HMAC-SHA256): ${signature}`,
      ];
      let y = height - 110;
      for (const line of lines) {
        page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 16;
      }
      page.drawLine({ start: { x: 40, y: y - 10 }, end: { x: width - 40, y: y - 10 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 30;

      // Snapshot preview (first 15)
      const rows: any[] = Array.isArray(report.snapshot) ? report.snapshot : [];
      page.drawText("Snapshot Preview (first 15 rows)", { x: 40, y, size: 12, font: fontBold });
      y -= 20;

      const columns = ["contract_number", "tracking_id", "title", "status", "final_amount", "last_updated"];
      page.drawText(columns.join(" | "), { x: 40, y, size: 8, font: fontBold });
      y -= 12;

      for (const row of rows.slice(0, 15)) {
        const line = [
          row?.contract_number ?? "—",
          row?.tracking_id ?? "—",
          String(row?.title ?? "—").slice(0, 28),
          row?.status ?? "—",
          formatMoney(row?.final_amount),
          safeDate(row?.last_updated ?? row?.updated_at),
        ].join(" | ");
        page.drawText(line, { x: 40, y, size: 8, font });
        y -= 12;
        if (y < 60) break;
      }

      page.drawText(
        "This document is system-generated. Any changes invalidate checksum/signature.",
        { x: 40, y: 30, size: 8, font }
      );

      pdfDoc.setTitle(`Compliance Report ${report.id}`);
      pdfDoc.setSubject("Locked compliance snapshot");
      pdfDoc.setCreator("iVibeZ Solutions");
      pdfDoc.setProducer("iVibeZ Solutions");

      const pdfBytes = await pdfDoc.save();

      // Audit (non-blocking)
      try {
        await logAudit({
          supabase,
          org_id: orgId,
          user_id: user.id,
          action: "report_downloaded_pdf",
          entity_type: "report",
          entity_id: reportId,
          metadata: {
            report_type: report.report_type,
            contract_count: report.contract_count,
            checksum: report.checksum,
            signature,
          },
        });
      } catch {}

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="compliance-report-${report.id}.pdf"`,
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      });
    }
  );
}
