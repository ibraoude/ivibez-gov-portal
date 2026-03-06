'use client'

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (!error && data) {
        setReport(data);
      }

      setLoading(false);
    };

    fetchReport();
  }, [reportId]);

  if (loading) return <div className="p-6">Loading report...</div>;

  if (!report) return <div className="p-6">Report not found.</div>;

  if (report.status !== "locked") {
    return (
      <div className="p-6 text-red-600">
        This report must be approved and locked before viewing.
      </div>
    );
  }

  const handleDownload = async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    const res = await fetch(`/api/reports/${report.id}/download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Download failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${report.id}.csv`;
    a.click();

    window.URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    const token = sessionData.session?.access_token;

    if (!token) {
      alert("You are not logged in.");
      return;
    }

    const res = await fetch(`/api/reports/${report.id}/download-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      let errMessage = "PDF download failed";

      const body = await res.text();

      try {
        const data = JSON.parse(body);
        errMessage = data.error || errMessage;
      } catch {
        if (body) errMessage = body;
      }

      alert(errMessage);
      return;
    }

    // Download the PDF
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report.id}.pdf`;
    a.click();

    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      <h1 className="text-xl font-semibold">Report Snapshot</h1>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Contracts: {report.contract_count}
        </div>

        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Download JSON
        </button>
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-sm"
        >
          Download PDF
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs max-h-[500px]">
        <pre>{JSON.stringify(report.snapshot, null, 2)}</pre>
      </div>
    </div>
  );
}