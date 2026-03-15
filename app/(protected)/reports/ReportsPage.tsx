"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/permissions/roles";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  FileText,
  CheckCircle2,
  Lock,
  Filter,
  Download,
  RefreshCcw,
  Loader2,
} from "lucide-react";

/* ===================== TYPES ===================== */

interface Report {
  id: string;
  report_type: string;
  contract_count: number | null;
  status: "draft" | "locked" | string;
  checksum?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  approver?: { email?: string } | null;
}

/* ===================== COMPONENT ===================== */

export default function ReportsPage() {

  const supabase = createClient();
  const router = useRouter();

  /* ===================== STATE ===================== */

  const [role, setRole] = useState<Role | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [generating, setGenerating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [includeSnapshot, setIncludeSnapshot] = useState(true);
  const [draftCount, setDraftCount] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [contractsCovered, setContractsCovered] = useState(0);

  /* ===================== INIT ===================== */

  useEffect(() => {
    (async () => {

      const { data: auth } = await supabase.auth.getUser();

      if (!auth?.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      setRole((profile?.role ?? "client") as Role);

      await fetchReports(true);

      setLoading(false);

    })();
  }, []);

  /* ===================== HELPERS ===================== */

  function escapeLike(input: string) {
    return input.replace(/[%_]/g, (m) => "\\" + m);
  }

  async function parseJsonOrText(res: Response) {

    const ct = res.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    }

    const text = await res.text();
    return { body: text };

  }

  /* ===================== FETCH REPORTS ===================== */

  async function fetchReports(resetPage = false, newPage?: number) {

    setLoadingList(true);

    try {

      const currentPage = resetPage ? 1 : newPage ?? page;

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("reports")
        .select(
          "id,report_type,contract_count,status,checksum,approved_at,approved_by,created_at",
          { count: "exact" }
        );

      if (statusFilter) query = query.eq("status", statusFilter);

      if (q.trim()) {
        const term = escapeLike(q.trim());
        query = query.or(`id.ilike.%${term}%,report_type.ilike.%${term}%`);
      }

      query = query
        .order("created_at", { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      const list = (data ?? []) as Report[];

      setReports(list);
      setTotal(count ?? 0);

      const drafts = list.filter((r) => r.status === "draft").length;
      const locked = list.filter((r) => r.status === "locked").length;

      const contracts = list.reduce((sum, r) => {
        return sum + (r.contract_count || 0);
      }, 0);

      setDraftCount(drafts);
      setLockedCount(locked);
      setContractsCovered(contracts);

      if (resetPage) setPage(1);

    } catch (e) {
      console.error(e);
      setReports([]);
    } finally {
      setLoadingList(false);
    }
  }

  /* ===================== ACTIONS ===================== */

  async function handleGenerate() {

    setGenerating(true);

    try {

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch("/api/compliance-report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ includeSnapshot }),
      });

      const payload = await parseJsonOrText(res);

      if (!res.ok) {
        throw new Error(payload?.error || "Report generation failed");
      }

      await fetchReports(true);

    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(id: string) {

    setApprovingId(id);

    try {

      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(`/api/reports/${id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      const payload = await parseJsonOrText(res);

      if (!res.ok) {
        throw new Error(payload?.error || "Approval failed");
      }

      await fetchReports(false);

    } catch (e: any) {
      alert(e.message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDownloadJSON(id: string) {

    setDownloadingId(id);

    try {

      const { data, error } = await supabase
        .from("reports")
        .select("snapshot,created_at")
        .eq("id", id)
        .single();

      if (error) throw error;

      const json = JSON.stringify((data as any)?.snapshot ?? {}, null, 2);

      const blob = new Blob([json], { type: "application/json" });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${id}.json`;
      a.click();

      URL.revokeObjectURL(url);

    } catch (e: any) {
      alert(e.message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExportCSV() {
    try {

      const { data, error } = await supabase
        .from("reports")
        .select("snapshot");

      if (error) throw error;

      const reports = data ?? [];

      const csvRows: string[] = [];

      csvRows.push([
        "Contract Number",
        "Title",
        "Status",
        "Payment Status",
        "Amount",
        "Start Date",
        "End Date"
      ].join(","));

      reports.forEach((r: any) => {

        const contracts = r.snapshot ?? [];

        contracts.forEach((c: any) => {

          csvRows.push([
            c.contract_number ?? "",
            c.title ?? "",
            c.status ?? "",
            c.payment_status ?? "",
            c.final_amount ?? 0,
            c.period_start ?? "",
            c.period_end ?? ""
          ].join(","));

        });

      });

      const blob = new Blob([csvRows.join("\n")], {
        type: "text/csv",
      });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance-report.csv";
      a.click();

      URL.revokeObjectURL(url);

    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDownloadPDF() {

    try {

      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        alert("No report found.");
        return;
      }

      const report = data;
      const contracts = report.snapshot ?? [];

      const doc = new jsPDF();

      /* ================= WATERMARK ================= */

      doc.setTextColor(235);
      doc.setFontSize(60);
      doc.text("CONFIDENTIAL", 105, 160, {
        align: "center",
        angle: 45,
      });

      doc.setTextColor(0);

      /* ================= HEADER ================= */

      const img = new Image();
      img.src = "/logo.png";

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const maxWidth = 100;   // max width allowed
      const maxHeight = 35;  // max height allowed

      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height);

      width *= ratio;
      height *= ratio;

      doc.addImage(img, "PNG", 20, 3, width, height);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);

      doc.text("Compliance Report (Locked)", 105, 20, {
        align: "center",
      });

      doc.setLineWidth(0.5);
      doc.line(20, 30, 190, 30);

      /* ================= METADATA ================= */

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      let y = 40;

      doc.text(`Report ID: ${report.id}`, 20, y);
      y += 6;

      doc.text(`Type: ${report.report_type}`, 20, y);
      y += 6;

      doc.text(`Contract Count: ${contracts.length}`, 20, y);
      y += 6;

      doc.text(`Approved By: ${report.approved_by ?? "-"}`, 20, y);
      y += 6;

      doc.text(
        `Approved At: ${
          report.approved_at
            ? new Date(report.approved_at).toLocaleString()
            : "-"
        }`,
        20,
        y
      );

      y += 6;

      doc.text(
        `Generated At: ${new Date(report.created_at).toLocaleString()}`,
        20,
        y
      );

      y += 10;

      /* ================= TABLE DATA ================= */

      const tableRows = contracts.map((c: any) => [
        c.contract_number ?? "-",
        c.tracking_id ?? "-",
        c.title ?? "-",
        c.status ?? "-",
        `$${(c.final_amount ?? 0).toLocaleString()}`,
        c.updated_at
          ? new Date(c.updated_at).toLocaleDateString()
          : "-"
      ]);

      /* ================= CONTRACT TABLE ================= */

      autoTable(doc, {
        startY: y,
        head: [[
          "Contract #",
          "Tracking ID",
          "Title",
          "Status",
          "Amount",
          "Last Updated"
        ]],
        body: tableRows,
        styles: {
          fontSize: 9
        },
        headStyles: {
          fillColor: [30, 64, 175]
        }
      });

      /* ================= TOTAL SUMMARY ================= */

      const totalAmount = contracts.reduce(
        (sum: number, c: any) => sum + (c.final_amount ?? 0),
        0
      );

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFont("helvetica", "bold");
      doc.text(
        `Total Contract Value: $${totalAmount.toLocaleString()}`,
        20,
        finalY
      );

      /* ================= SIGNATURE ================= */

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.text(
        `Checksum (SHA-256): ${report.checksum ?? "-"}`,
        20,
        finalY + 10
      );

      doc.text(
        "Digitally Signed by iVibeZ Compliance System",
        20,
        finalY + 16
      );

      /* ================= FOOTER ================= */

      const pageCount = doc.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {

        doc.setPage(i);

        doc.setFontSize(8);

        doc.text(
          `Generated by iVibeZ Solutions Compliance Engine`,
          20,
          285
        );

        doc.text(
          `Page ${i} of ${pageCount}`,
          190,
          285,
          { align: "right" }
        );
      }

      /* ================= SAVE ================= */

      doc.save(`compliance-report-${report.id}.pdf`);

    } catch (e: any) {

      alert(e.message);

    }

  }

  /* ===================== PERMISSIONS ===================== */

  const canGenerate =
    role === "owner" ||
    role === "admin" ||
    role === "manager";

  const canApprove =
    role === "owner" ||
    role === "admin" ||
    role === "manager";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* ===================== LOADING ===================== */

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold">Compliance Reports</h1>
              <p className="text-xs text-gray-500">
                Create and approve compliance snapshots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">

          {/* Create Report */}

          {canGenerate && (
            <button
              onClick={() => router.push("/reports/create")}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white"
            >
              <FileText className="h-4 w-4" />
              Create Report
            </button>
          )}

          {/* Generate Report */}

          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Generate
            </button>
          )}

          {/* Refresh */}

          <button
            onClick={() => fetchReports(true)}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {/* Export CSV */}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>

          {/* Download PDF */}

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>

        </div>

        </div>
      </header>

      {/* REPORT LIST */}

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      
      <div className="grid grid-cols-4 gap-4">

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Total Reports</div>
          <div className="text-2xl font-semibold">{total}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Draft Reports</div>
          <div className="text-2xl font-semibold">{draftCount}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Locked Reports</div>
          <div className="text-2xl font-semibold">{lockedCount}</div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Contracts Covered</div>
          <div className="text-2xl font-semibold">
            {contractsCovered.toLocaleString()}
          </div>
        </div>

      </div>

        {loadingList ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center text-gray-500">
            No reports found.
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-white">

            {reports.map((r) => (

              <div
                key={r.id}
                className="flex items-center justify-between px-6 py-4"
              >

                <div className="flex items-center gap-4">

                  {r.status === "locked" ? (
                    <Lock className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-yellow-600" />
                  )}

                  <div>

                    <div className="text-sm font-semibold">
                      {r.report_type} • {r.id}
                    </div>

                    <div className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleString()}
                    </div>

                  </div>

                </div>

                <div className="flex items-center gap-2">

                  <Link
                    href={`/reports/${r.id}`}
                    className="rounded border px-3 py-1 text-xs"
                  >
                    View
                  </Link>

                  <button
                    onClick={() => handleDownloadJSON(r.id)}
                    disabled={downloadingId === r.id}
                    className="flex items-center gap-1 rounded border px-3 py-1 text-xs"
                  >
                    {downloadingId === r.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    JSON
                  </button>

                  {r.status === "draft" && canApprove && (
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={approvingId === r.id}
                      className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs text-white"
                    >
                      {approvingId === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Approve
                    </button>
                  )}

                </div>

              </div>

            ))}

          </div>
        )}

      </main>
    </div>
  );
}