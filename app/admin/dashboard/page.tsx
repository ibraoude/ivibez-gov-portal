'use client'

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  AlertTriangle,
  TrendingUp,
  Shield,
  DollarSign
} from "lucide-react";

interface GovernmentContract {
  id: string;
  contract_number?: string;
  tracking_id: string;
  gov_type: string;
  title: string;
  status: string;
  final_amount?: number;
  period_of_performance?: string;
  progress_percentage?: number;
  created_at: string;
  last_updated?: string;
  period_start?: Date;
  period_end?: Date;
}

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [contracts, setContracts] = useState<GovernmentContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
      await fetchContracts();
      setLoading(false);
    };

    init();
  }, []);

  async function fetchContracts() {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setContracts(data || []);
  }

  function daysBetween(a: Date, b: Date) {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  }

  function isAutoAtRisk(c: GovernmentContract) {
    if (c.status === "at_risk") return true;

    const burn = calculateBurnMetrics(c);
      if (burn && burn.variance < -0.1) {
        return true;
}
    const now = new Date();
    const updated = c.last_updated ? new Date(c.last_updated) : null;

    if (c.status === "active" && updated) {
      const stale = daysBetween(now, updated);
      if (stale >= 14) return true;
    }

    if (c.status === "active" && (c.progress_percentage || 0) < 10) {
      return true;
    }

    return false;
  }

  function calculateBurnMetrics(contract: GovernmentContract) {
    if (!contract.final_amount || !contract.period_start || !contract.period_end) {
      return null;
    }

    const start = new Date(contract.period_start);
    const end = new Date(contract.period_end);
    const now = new Date();

    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    const timeBurn = Math.min(Math.max(elapsedDays / totalDays, 0), 1);
    const progressBurn = (contract.progress_percentage || 0) / 100;

    const earnedRevenue = contract.final_amount * progressBurn;
    const expectedRevenue = contract.final_amount * timeBurn;

    const variance = progressBurn - timeBurn;

    return {
      earnedRevenue,
      expectedRevenue,
      variance,
      timeBurnPercent: Math.round(timeBurn * 100),
    };
  }

  const activeContracts = contracts.filter(c => c.status === "active");
  const atRiskContracts = contracts.filter(c => isAutoAtRisk(c));
  const completedContracts = contracts.filter(c => c.status === "completed");

  const portfolioValue = contracts.reduce(
    (sum, c) => sum + (c.final_amount || 0),
    0
  );

  const activeExposure = activeContracts.reduce(
    (sum, c) => sum + (c.final_amount || 0),
    0
  );

  const atRiskRevenue = atRiskContracts.reduce(
    (sum, c) => sum + (c.final_amount || 0),
    0
  );

  const avgCompletion = activeContracts.length === 0
    ? 0
    : Math.round(
        activeContracts.reduce((sum, c) => sum + (c.progress_percentage || 0), 0) /
        activeContracts.length
      );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!user) return null;

  const firstName = user.email?.split("@")[0];

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold">
              Portfolio Command Center
            </h1>
            <p className="text-gray-500">
              Welcome back, {firstName}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* ===== EXECUTIVE KPIs ===== */}
        <div className="grid md:grid-cols-4 gap-6">

          <StatCard
            title="Total Portfolio Value"
            value={`$${portfolioValue.toLocaleString()}`}
            icon={<DollarSign className="h-6 w-6 text-green-600" />}
          />

          <StatCard
            title="Active Exposure"
            value={`$${activeExposure.toLocaleString()}`}
            icon={<TrendingUp className="h-6 w-6 text-blue-600" />}
          />

          <StatCard
            title="At Risk Revenue"
            value={`$${atRiskRevenue.toLocaleString()}`}
            icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          />

          <StatCard
            title="Avg Completion"
            value={`${avgCompletion}%`}
            icon={<Shield className="h-6 w-6 text-purple-600" />}
          />

        </div>

        {/* ===== ATTENTION PANEL ===== */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            Contracts Requiring Attention
          </h2>

          {atRiskContracts.length === 0 ? (
            <p className="text-gray-500">
              All active contracts are performing normally.
            </p>
          ) : (
            atRiskContracts.map(contract => (
              <div
                key={contract.id}
                className="border rounded-lg p-4 mb-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">
                    {contract.contract_number || contract.tracking_id}
                  </p>
                  <p className="text-sm text-gray-500">
                    Low progress or stale update
                  </p>
                </div>

                <Link
                  href={`/dashboard/contracts/${contract.id}`}
                  className="text-red-600 text-sm font-medium"
                >
                  Review →
                </Link>
              </div>
            ))
          )}
        </div>

        {/* ===== ACTIVE CONTRACTS ===== */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">
              Active Contracts
            </h2>
          </div>

          <div className="p-6 space-y-4">

            {activeContracts.length === 0 ? (
              <p className="text-gray-500 text-center">
                No active contracts.
              </p>
            ) : (
              activeContracts.map(contract => (
                <div
                  key={contract.id}
                  className="border rounded-xl px-6 py-5 hover:shadow-sm transition"
                >
                  <div className="flex justify-between items-center">

                    <div>
                      <h3 className="font-semibold text-lg">
                        {contract.contract_number || contract.tracking_id}
                      </h3>

                      <p className="text-sm text-gray-600">
                        ${contract.final_amount?.toLocaleString() || "—"}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        {contract.period_of_performance || "No period set"}
                      </p>
                    </div>

                    <div className="text-right space-y-2">

                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          isAutoAtRisk(contract)
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isAutoAtRisk(contract) ? "At Risk" : "Active"}
                      </span>

                      <p className="text-xs text-gray-600">
                        {(() => {
                          const burn = calculateBurnMetrics(contract);
                          if (!burn) return null;

                          return (
                            <div className="mt-2 text-xs space-y-1">

                              <div className="flex justify-between">
                                <span>Earned Revenue</span>
                                <span className="font-medium">
                                  ${burn.earnedRevenue.toLocaleString()}
                                </span>
                              </div>

                              <div className="flex justify-between">
                                <span>Expected by Now</span>
                                <span>
                                  ${burn.expectedRevenue.toLocaleString()}
                                </span>
                              </div>

                              <div className="flex justify-between">
                                <span>Schedule Variance</span>
                                <span
                                  className={`font-medium ${
                                    burn.variance < -0.05
                                      ? "text-red-600"
                                      : burn.variance > 0.05
                                      ? "text-green-600"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {(burn.variance * 100).toFixed(1)}%
                                </span>
                              </div>

                            </div>
                          );
                        })()}
                      </p>

                      <Link
                        href={`/dashboard/contracts/${contract.id}`}
                        className="inline-block mt-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Manage
                      </Link>

                    </div>

                  </div>
                </div>
              ))
            )}

          </div>
        </div>

      </div>

    </div>
  );
}

/* ===== COMPONENTS ===== */

function StatCard({ title, value, icon }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
      <div className="bg-gray-100 p-3 rounded-lg">
        {icon}
      </div>
      <div>
        <p className="text-gray-500 text-sm">{title}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}