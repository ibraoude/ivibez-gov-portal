'use client'

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ReqRow = {
  id: string;
  tracking_id: string;
  gov_type: string;
  status: string;
  requester_email: string | null;
  title: string | null;
  created_at: string;
  awarded: boolean;
  admin_status: string | null;
  contract_number: string | null;
  progress_percentage: number | null;
  last_updated: string | null;
};

export default function AdminRequestsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      // admin check
      const adminCheck = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!adminCheck.data) {
        router.push("/admin");
        return;
      }

      setIsAdmin(true);
      setChecking(false);

      await load();
    })();
  }, [router]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_requests")
      .select("id,tracking_id,gov_type,status,requester_email,title,created_at,awarded,admin_status")
      .order("created_at", { ascending: false });

    if (!error) setRows((data as any) || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase
      .from("service_requests")
      .update({ status })
      .eq("id", id);

    await load();
  }

  async function updateAdminStatus(id: string, newAdminStatus: string) {
    try {
      // 1️⃣ Fetch the request
      const { data: request, error: fetchError } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !request) {
        console.error(fetchError);
        return;
      }

      // 2️⃣ If awarding → create contract first
      if (newAdminStatus === "awarded") {

        // Prevent duplicate contracts
        const { data: existingContract } = await supabase
          .from("contracts")
          .select("id")
          .eq("source_request_id", id)
          .maybeSingle();

        if (!existingContract) {

          const year = new Date().getFullYear();
          const random = Math.floor(1000 + Math.random() * 9000);
          const generatedContractNumber = `${request.gov_type?.toUpperCase() || "CON"}-${year}-${random}`;

          const { error: contractError } = await supabase
            .from("contracts")
            .insert({
              contract_number: generatedContractNumber,
              tracking_id: request.tracking_id,   // ✅ keep original tracking id
              source_request_id: request.id,
              source_type: "request",
              owner_id: request.submitted_by,     // ✅ CRITICAL LINE
              gov_type: request.gov_type,
              title: request.title,
              description: request.description,
              status: "draft",
              progress_percentage: 0,
              final_amount: request.final_amount || null,
              period_of_performance: request.period_of_performance || null,
            });

          if (contractError) {
            console.error(contractError);
            alert("Failed to create contract.");
            return;
          }
        }
      }

      // 3️⃣ Update service_request lifecycle
      const { error: updateError } = await supabase
        .from("service_requests")
        .update({
          admin_status: newAdminStatus,
          awarded: newAdminStatus === "awarded" ? true : request.awarded,
          status:
            newAdminStatus === "awarded"
              ? "completed"
              : request.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        console.error(updateError);
        return;
      }

      await load();

    } catch (err) {
      console.error(err);
    }
  }


  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter(r => r.status === statusFilter);
  }, [rows, statusFilter]);

  if (checking) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-6">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Project Lifecycle Management</h1>
            <p className="text-gray-500 text-sm">Track, triage, and update request statuses.</p>
          </div>

          <select
            value={statusFilter}
            onChange={(e)=>setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4 font-medium">Requests</div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-6 py-3">Tracking ID</th>
                    <th className="text-left px-6 py-3">Type</th>
                    <th className="text-left px-6 py-3">Title</th>
                    <th className="text-left px-6 py-3">Requester</th>
                    <th className="text-left px-6 py-3">Created</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Awarded</th>
                    <th className="text-left px-6 py-3">Admin Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-6 py-3 font-semibold">{r.tracking_id}</td>
                      <td className="px-6 py-3 capitalize">{r.gov_type}</td>
                      <td className="px-6 py-3">{r.title || "—"}</td>
                      <td className="px-6 py-3">{r.requester_email || "—"}</td>
                      <td className="px-6 py-3">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <select
                          value={r.status}
                          onChange={(e)=>updateStatus(r.id, e.target.value)}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={r.admin_status || "submitted"}
                          onChange={(e) => updateAdminStatus(r.id, e.target.value)}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          <option value="submitted">Submitted</option>
                          <option value="under_review">Under Review</option>
                          <option value="needs_revision">Needs Revision</option>
                          <option value="awarded">Awarded</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-6 py-3 space-y-2">

                      {/* If NOT awarded yet */}
                      {!r.awarded && (
                        <button
                          onClick={() => updateAdminStatus(r.id, "awarded")}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Award Contract
                        </button>
                      )}

                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}