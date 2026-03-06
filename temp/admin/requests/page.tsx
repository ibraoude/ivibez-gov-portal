'use client'

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  FileText,
  Clock,
  CheckCircle,
  Plus,
  LogOut,
  Shield
} from "lucide-react";

interface ServiceRequest {
  id: string;
  tracking_id: string;
  gov_type: string;
  status: string;
  title: string;
  created_at: string;
  awarded?: boolean;
}

interface GovernmentContract {
  id: string;
  service_request_id?: string | null;
  contract_number?: string;
  final_amount?: number;
  period_of_performance?: string;
  progress_percentage?: number;
  last_updated?: string;
  admin_status?: string;
  status: string;
  created_at: string;

  service_requests?: {
    tracking_id: string;
    gov_type: string;
    title: string;
  } | null;
}


export default function Dashboard() {
  const router = useRouter();

  interface AppUser {
    id: string;
    email: string;
    role: "admin" | "manager" | "client" | "auditor";
    org_id: string;
  }

  const [user, setUser] = useState<AppUser | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [contracts, setContracts] = useState<GovernmentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    contractId: "",
    agency: "",
    status: "",
    startDate: "",
    endDate: "",
  });


    // =====================
  // COMPLIANCE KPI METRICS
  // =====================
  const today = new Date();

  function parsePeriodEnd(period?: string) {
    // Expected formats:
    // 1) "YYYY-MM-DD to YYYY-MM-DD"
    // 2) "YYYY-MM-DD - YYYY-MM-DD"
    if (!period) return null;
    const normalized = period.replace(" - ", " to ");
    const parts = normalized.split("to");
    const end = parts[1]?.trim();
    if (!end) return null;

    const d = new Date(end);
    return isNaN(d.getTime()) ? null : d;
  }

  const portfolioValue = contracts.reduce(
    (sum, c) => sum + (c.final_amount || 0),
    0
  );

  const activeCount = contracts.filter(c => c.status === "active").length;

  const expiringSoonCount = contracts.filter(c => {
    const endDate = parsePeriodEnd(c.period_of_performance);
    if (!endDate) return false;
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 60 && daysLeft >= 0;
  }).length;

  const avgCompletion =
    contracts.length > 0
      ? Math.round(
          contracts.reduce(
            (sum, c) => sum + (c.progress_percentage || 0),
            0
          ) / contracts.length
        )
      : 0;

  // Simple "behind schedule" heuristic example:
  // active contracts with progress < 50% AND last updated > 30 days ago
  const behindScheduleCount = contracts.filter(c => {
    if (c.status !== "active") return false;
    const progress = c.progress_percentage || 0;
    if (progress >= 50) return false;

    if (!c.last_updated) return true; // no update -> risk
    const last = new Date(c.last_updated);
    if (isNaN(last.getTime())) return true;

    const daysSinceUpdate = Math.ceil((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate > 30;
  }).length;



  const filteredContracts = contracts.filter((contract) => {
    // 1) Contract ID match
    const matchesContractId =
      !filters.contractId ||
      (contract.contract_number ||contract.service_requests?.tracking_id || "")
        .toLowerCase()
        .includes(filters.contractId.toLowerCase());

    // 2) Agency match (replace contract.title with contract.agency when you add it)
    const matchesAgency =
      !filters.agency ||
      (contract.service_requests?.gov_type || "")
        .toLowerCase()
        .includes(filters.agency.toLowerCase());

    // 3) Status match
    const matchesStatus =
      !filters.status || contract.status === filters.status;

    // 4) Date match (using created_at for now)
    const contractDate = contract.created_at ? new Date(contract.created_at) : null;

    const matchesStartDate =
      !filters.startDate ||
      (contractDate && contractDate >= new Date(filters.startDate));

    const matchesEndDate =
      !filters.endDate ||
      (contractDate && contractDate <= new Date(filters.endDate));

    return (
      matchesContractId &&
      matchesAgency &&
      matchesStatus &&
      matchesStartDate &&
      matchesEndDate
    );
  });

  useEffect(() => {
    const init = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.push("/login");
        return;
      }

      // Fetch profile AFTER confirming user exists
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, org_id")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error("Profile not found:", profileError);
        return;
      }

      // Set full user object once
      setUser({
        id: authData.user.id,
        email: authData.user.email!,
        role: profile.role,
        org_id: profile.org_id,
      });

      await fetchRequests();
      await fetchContracts();
      setLoading(false);
    };

    init();
  }, []);

  async function fetchRequests() {
    const { data, error } = await supabase
      .from("service_requests")
      .select("id,tracking_id,gov_type,status,requester_email,title,created_at,awarded,admin_status")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setRequests(data || []);
  }

  async function fetchContracts() {
    const { data, error } = await supabase
      .from("contracts")
      .select(`
        id,
        service_request_id,
        contract_number,
        final_amount,
        period_of_performance,
        progress_percentage,
        last_updated,
        admin_status,
        status,
        created_at,
        service_requests!contracts_service_request_id_fkey (
          tracking_id,
          gov_type,
          title
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contracts:", error);
      return;
    }

    // normalize service_requests (Supabase returns array)
    const normalized = (data || []).map((row: any) => ({
      ...row,
      service_requests: Array.isArray(row.service_requests)
        ? row.service_requests[0] ?? null
        : row.service_requests ?? null,
    }));

    setContracts(normalized);
  }
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!user) return null;

  const firstName = user.email?.split("@")[0];

  const totalRequests = requests.length;
  const pending = requests.filter(r => r.status === "pending").length;
  const completed = requests.filter(r => r.status === "completed").length;

 return (
  <div className="min-h-screen bg-gray-100">

    {/* HEADER */}
    <div className="bg-white border-b w-full">
      <div className="w-full px-4 md:px-6 lg:px-8 py-4 md:py-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold">
            Welcome, {firstName}!
          </h1>
          <p className="text-gray-500">{user.email}</p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Home
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>

    {/* MAIN CONTENT GRID */}
    <div className="bg-white border-b w-full">
      <div className="grid grid-cols-4 gap-8 items-start">

        {/* ================= PROJECT LOOKUP ================= */}
        <div className="col-span-1">

          <div className="bg-white rounded-xl shadow-sm sticky top-6">

            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                Project Lookup
              </h2>
            </div>

            <div className="p-6 space-y-4">

              <input
                type="text"
                placeholder="Search by Contract ID"
                value={filters.contractId}
                onChange={(e) =>
                  setFilters({ ...filters, contractId: e.target.value })
                }
                className="w-full border rounded-lg px-4 py-2"
              />

              <input
                type="text"
                placeholder="Search by Agency"
                value={filters.agency}
                onChange={(e) =>
                  setFilters({ ...filters, agency: e.target.value })
                }
                className="w-full border rounded-lg px-4 py-2"
              />

              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full border rounded-lg px-4 py-2"
              >
                <option value="">Filter by Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>

              <div className="space-y-3">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                Search
              </button>
              <button
                onClick={() =>
                  setFilters({
                    contractId: "",
                    agency: "",
                    status: "",
                    startDate: "",
                    endDate: "",
                  })
                }
                className="w-full border py-2 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>

            </div>

          </div>

        </div>

        {/* ================= RIGHT MAIN CONTENT ================= */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
            Loading dashboard data...
          </div>
        )}
        <div className="col-span-3 space-y-8">


        {/* ===== COMPLIANCE SUMMARY BANNER ===== */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Compliance Overview</h2>
              <p className="text-sm text-gray-600 mt-1">
                Monitor contract health, timelines, documentation readiness, and audit traceability.
              </p>
            </div>

            <div className="flex gap-3">
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
                Export Portfolio CSV
              </button>
              <button
                onClick={async () => {
                  const response = await fetch("/api/compliance-report", {
                    method: "POST",
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    alert(data.error || "Error generating report");
                    return;
                  }

                  console.log("Report data:", data);
                  alert(`Report generated. ${data.contract_count} contracts found.`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Generate Compliance Report
              </button>
            </div>
          </div>
        </div>

        {/* ===== COMPLIANCE KPI ROW ===== */}
        <div className="grid md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <p className="text-xs text-gray-500">Portfolio Value</p>
            <p className="text-xl font-semibold mt-1">
              ${portfolioValue.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <p className="text-xs text-gray-500">Active Contracts</p>
            <p className="text-xl font-semibold mt-1">{activeCount}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <p className="text-xs text-gray-500">Expiring ≤ 60 Days</p>
            <p className="text-xl font-semibold mt-1">{expiringSoonCount}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <p className="text-xs text-gray-500">Behind Schedule</p>
            <p className="text-xl font-semibold mt-1">{behindScheduleCount}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border">
            <p className="text-xs text-gray-500">Avg Completion</p>
            <p className="text-xl font-semibold mt-1">{avgCompletion}%</p>
          </div>
        </div>

          {/* ===== STATS CARDS ===== */}
          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total Requests</p>
                <p className="text-3xl font-semibold">{totalRequests}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Pending</p>
                <p className="text-3xl font-semibold">{pending}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Completed</p>
                <p className="text-3xl font-semibold">{completed}</p>
              </div>
            </div>

          </div>

          {/* ===== COMPLIANCE EXCEPTIONS ===== */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Compliance Exceptions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Contracts requiring immediate review (schedule risk, expiring soon, or missing updates).
              </p>
            </div>

            <div className="p-6 space-y-3">
              {contracts.filter(c => {
                const endDate = parsePeriodEnd(c.period_of_performance);
                const daysLeft = endDate
                  ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : null;

                const expiringSoon = daysLeft !== null && daysLeft <= 60 && daysLeft >= 0;

                const progress = c.progress_percentage || 0;
                const last = c.last_updated ? new Date(c.last_updated) : null;
                const daysSinceUpdate = last && !isNaN(last.getTime())
                  ? Math.ceil((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
                  : 999;

                const behind = c.status === "active" && progress < 50 && daysSinceUpdate > 30;

                return expiringSoon || behind;
              }).slice(0, 5).length === 0 ? (
                <p className="text-gray-500">No exceptions detected.</p>
              ) : (
                contracts
                  .filter(c => {
                    const endDate = parsePeriodEnd(c.period_of_performance);
                    const daysLeft = endDate
                      ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    const expiringSoon = daysLeft !== null && daysLeft <= 60 && daysLeft >= 0;

                    const progress = c.progress_percentage || 0;
                    const last = c.last_updated ? new Date(c.last_updated) : null;
                    const daysSinceUpdate = last && !isNaN(last.getTime())
                      ? Math.ceil((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
                      : 999;

                    const behind = c.status === "active" && progress < 50 && daysSinceUpdate > 30;

                    return expiringSoon || behind;
                  })
                  .slice(0, 5)
                  .map(c => (
                    <div key={c.id} className="border rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold">
                          {c.contract_number || c.service_requests?.tracking_id || c.id}
                        </p>
                        <p className="text-sm text-gray-600">{c.service_requests?.title}</p>
                      </div>

                      <Link
                        href={`/contracts/${c.id}`}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Review
                      </Link>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* ===== GOVERNMENT CONTRACTS ===== */}
          <div className="bg-white rounded-xl shadow-sm">

            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">
                Government Contracts
              </h2>
            </div>

            <div className="p-6 space-y-4">

              {filteredContracts.length === 0 ? (
                <p className="text-gray-500 text-center py-6">
                  No contracts found.
                </p>
              ) : (
              filteredContracts.map((contract) => {
                const endDate = parsePeriodEnd(contract.period_of_performance);
                const daysLeft = endDate
                  ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <div
                    key={contract.id}
                    className="border rounded-xl px-6 py-5 hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between">

                      {/* LEFT SECTION */}
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">
                          {contract.contract_number || contract.service_requests?.tracking_id || contract.id}
                        </h3>

                        <p className="text-sm text-gray-600">
                          Final Amount:{" "}
                          <span className="font-medium text-gray-900">
                            ${contract.final_amount?.toLocaleString() || "—"}
                          </span>
                        </p>

                        <p className="text-sm text-gray-600">
                          Admin Status:{" "}
                          <span className="text-gray-800">
                            {contract.admin_status || "—"}
                          </span>
                        </p>

                        <p className="text-sm text-gray-600">
                          Last Updated:{" "}
                          <span className="text-gray-800">
                            {contract.last_updated
                              ? new Date(contract.last_updated).toLocaleDateString()
                              : "—"}
                          </span>
                        </p>
                      </div>

                      {/* RIGHT SECTION */}
                      <div className="text-right space-y-2">

                        {/* STATUS BADGE */}
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${
                            contract.status === "active"
                              ? "bg-blue-100 text-blue-800"
                              : contract.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : contract.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {contract.status || "unknown"}
                        </span>

                        {/* PROGRESS BAR */}
                        <div className="mt-2">
                          <div className="w-40 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${contract.progress_percentage || 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {contract.progress_percentage || 0}% Complete
                          </p>

                          {daysLeft !== null && daysLeft <= 60 && daysLeft >= 0 && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠ Expiring in {daysLeft} day{daysLeft === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>

                        {/* QUICK VIEW */}
                        {user.role === "admin" || user.role === "manager" ? (
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="inline-block mt-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Manage
                        </Link>
                      ) : (
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="inline-block mt-2 px-4 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          View
                        </Link>
                      )}
                      {(user?.role === "admin" || user?.role === "manager") && (
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Generate Compliance Report
                        </button>
                      )}

                      </div>
                    </div>
                  </div>
                );
              })
              )}

            </div>
          </div>

          {/* ===== SERVICE REQUESTS ===== */}
          <div className="bg-white rounded-xl shadow-sm">

            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">
                Your Recent Service Requests
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {requests.slice(0, 25).map((request) => (
                <div
                  key={request.id}
                  className="border rounded-xl px-6 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Tracking ID:
                        </span>
                        <span className="font-semibold text-gray-900">
                          {request.tracking_id}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600">
                        {request.gov_type}
                        <span className="mx-2">•</span>
                        {new Date(request.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {!request.awarded && (
                        <Link
                          href={`/requests/edit/${request.id}`}
                          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit & Resubmit
                        </Link>
                      )}

                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          request.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : request.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>

                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </div>

  </div>
);
}