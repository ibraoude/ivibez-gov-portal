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
  tracking_id: string;
  gov_type: string;
  title: string;
  description: string;
  status: string;
  created_at: string;

  // new lifecycle fields
  contract_number?: string;
  final_amount?: number;
  period_of_performance?: string;
  progress_percentage?: number;
  last_updated?: string;
  admin_status?: string;
  awarded?: boolean;
}

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
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
  const awardedContracts = contracts.filter(c => c.awarded === true);

  const filteredContracts = awardedContracts.filter((contract) => {
    // 1) Contract ID match
    const matchesContractId =
      !filters.contractId ||
      (contract.contract_number || contract.tracking_id || "")
        .toLowerCase()
        .includes(filters.contractId.toLowerCase());

    // 2) Agency match (replace contract.title with contract.agency when you add it)
    const matchesAgency =
      !filters.agency ||
      (contract.title || "")
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
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
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
      .from("service_requests")
      .select("*")
      .eq("awarded", true) // only awarded become contracts
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setContracts(data || []);
    }
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
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold">
            Welcome, {firstName}!
          </h1>
          <p className="text-gray-500">{user.email}</p>
        </div>

        <div className="flex gap-3">
          <Link
              href="/dashboard/requests/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
              <Plus className="h-4 w-4" />
              New Request
          </Link>
          <Link
            href="/dashboard"
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
    <div className="max-w-7xl mx-auto px-6 py-10">
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
        <div className="col-span-3 space-y-8">

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
                filteredContracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="border rounded-xl px-6 py-5 hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between">

                      {/* LEFT SECTION */}
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">
                          {contract.contract_number || contract.tracking_id}
                        </h3>

                        <p className="text-sm text-gray-600">
                          Final Amount:{" "}
                          <span className="font-medium text-gray-900">
                            ${contract.final_amount?.toLocaleString() || "—"}
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

                        {/* PROGRESS */}
                        <p className="text-xs text-gray-600">
                          {contract.progress_percentage || 0}% Complete
                        </p>

                        {/* QUICK VIEW BUTTON */}
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="inline-block mt-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Quick View
                        </Link>

                      </div>

                    </div>
                  </div>
                ))
              )}

            </div>
          </div>

          {/* ===== SERVICE REQUESTS ===== */}
          <div className="bg-white rounded-xl shadow-sm">

            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">
                Your Recent Service Requests
              </h2>

              <Link
                href="/dashboard/requests/new"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Request
              </Link>
            </div>

            <div className="p-6 space-y-4">
              {requests.slice(0, 5).map((request) => (
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
                          href={`/dashboard/requests/edit/${request.id}`}
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