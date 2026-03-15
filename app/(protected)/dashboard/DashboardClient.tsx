
// app/(protected)/dashboard/DashboardClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  LogOut,
  AlertTriangle,
  TrendingUp,
  Shield,
  DollarSign,
  Moon,
  Sun,
} from "lucide-react";
import { motion, AnimatePresence, animate } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from "recharts";
import { createClient } from "@/lib/supabase/client";
import OrganizationOnboarding from "@/app/components/OrganizationOnboarding";

const supabase = createClient();

/* ===================== UI Model (strict, non-null where you render) ===================== */
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
  period_start?: Date | string;
  period_end?: Date | string;
}

/* ===================== DB Row Shape (nullable columns) ===================== */
type ContractRow = {
  id: string;
  tracking_id: string;
  contract_number: string | null;
  gov_type: string | null;
  title: string | null;
  status: string | null;
  final_amount: number | null;
  period_of_performance: string | null;
  progress_percentage: number | null;
  created_at: string | null;
  last_updated: string | null;
  period_start: string | null;
  period_end: string | null;

  // additional columns present in your table (safe to keep, ignored by UI model)
  admin_status: string | null;
  awarded_at: string | null;
  awarded_by: string | null;
  client_id: string | null;
  description: string | null;
  org_id: string | null;
  owner_id: string | null;
  service_request_id: string | null;
  source_request_id: string | null;
  source_type: string; // appears non-null in your example
  updated_at: string | null;
};

/* ===================== Mapper: ContractRow -> GovernmentContract ===================== */
function normalizeContract(row: ContractRow): GovernmentContract {
  return {
    id: row.id,
    tracking_id: row.tracking_id,
    contract_number: row.contract_number ?? "",
    gov_type: row.gov_type ?? "unknown",
    title: row.title ?? "(untitled)",
    status: row.status ?? "unknown",
    final_amount: row.final_amount ?? 0,
    period_of_performance: row.period_of_performance ?? "",
    progress_percentage: row.progress_percentage ?? 0,
    created_at: row.created_at ?? new Date().toISOString(),
    last_updated: row.last_updated ?? undefined,
    period_start: row.period_start ?? undefined,
    period_end: row.period_end ?? undefined,
  };
}

/* ===================== Dashboard Client ===================== */
export default function DashboardClient({
  user: userProp,
  initialContracts,
}: {
  user: any;
  initialContracts: GovernmentContract[]; // already normalized on the server
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Seed state from server props (no spinner)
  const [user] = useState<any>(userProp);
  const [contracts, setContracts] = useState<GovernmentContract[]>(initialContracts);
  const [loading] = useState(false);
  const [hasOrg, setHasOrg] = useState<boolean | null>(null);

  useEffect(() => {
    // Keep data fresh with Realtime; no auth gating here
    const channel = supabase
      .channel("contracts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contracts" },
        () => void fetchContracts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    async function checkOrgMembership() {
      if (!user?.id) {
        setHasOrg(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (error) {
        setHasOrg(false);
        return;
      }

      setHasOrg(!!data?.org_id);
    }

    checkOrgMembership();
  }, [user]);

  async function fetchContracts() {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .returns<ContractRow[]>();

    if (!error) {
      // ✅ Normalize DB rows to UI model
      const normalized: GovernmentContract[] =
        ((data as ContractRow[] | null) ?? []).map(normalizeContract);
      setContracts(normalized);
    }
  }

  function daysBetween(a: Date, b: Date) {
    const diff = a.getTime() - b.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function calculateBurnMetrics(c: GovernmentContract) {
    if (!c.final_amount || !c.period_start || !c.period_end) return null;

    const start = new Date(c.period_start);
    const end = new Date(c.period_end);
    const now = new Date();

    const total = (end.getTime() - start.getTime()) / 86400000;
    const elapsed = (now.getTime() - start.getTime()) / 86400000;

    const timeBurn = Math.min(Math.max(elapsed / total, 0), 1);
    const progressBurn = (c.progress_percentage || 0) / 100;

    return {
      earnedRevenue: c.final_amount * progressBurn,
      expectedRevenue: c.final_amount * timeBurn,
      variance: progressBurn - timeBurn,
      timeBurnPercent: Math.round(timeBurn * 100),
    };
  }

  function isAutoAtRisk(c: GovernmentContract) {
    if (c.status === "at_risk") return true;

    const burn = calculateBurnMetrics(c);
    if (burn && burn.variance < -0.1) return true;

    const now = new Date();
    const updated = c.last_updated ? new Date(c.last_updated) : null;

    if (c.status === "active" && updated) {
      if (daysBetween(now, updated) >= 14) return true;
    }
    if (c.status === "active" && (c.progress_percentage || 0) < 10) return true;

    return false;
  }

  /* ===================== Metrics ===================== */
  const activeContracts = contracts.filter((c) => c.status === "active");
  const atRiskContracts = contracts.filter((c) => isAutoAtRisk(c));
  const portfolioValue = contracts.reduce( (s, c) => s + (c.final_amount || 0), 0);
  const activeExposure = activeContracts.reduce((s, c) => s + (c.final_amount || 0),0);
  const atRiskRevenue = atRiskContracts.reduce( (s, c) => s + (c.final_amount || 0), 0);
  let avgCompletion = 0;
  if (activeContracts.length > 0) {
    const sum = activeContracts.reduce(
      (s, c) => s + (c.progress_percentage || 0),
      0
    );
    avgCompletion = Math.round(sum / activeContracts.length);
  }
  /* ===================== Sparklines ===================== */
  const sparkWeeks = 12;
  const sparklineData = (() => {
    const now = new Date();
    const weeks: { label: string; portfolio: number; active: number; risk: number; avg: number }[] = [];

    // Helper: get Monday of week offset
    const mondayOf = (d: Date) => {
      const tmp = new Date(d);
      const day = tmp.getDay(); // 0..6; 1=Mon
      const diff = (day === 0 ? -6 : 1) - day;
      tmp.setDate(tmp.getDate() + diff);
      tmp.setHours(0, 0, 0, 0);
      return tmp;
    };

    // Build week buckets
    for (let i = sparkWeeks - 1; i >= 0; i--) {
  const end = new Date(now);
  end.setDate(end.getDate() - i * 7);

  const start = mondayOf(end);

  const endWeek = new Date(start);
  endWeek.setDate(start.getDate() + 7);

  const weekContracts = contracts.filter((c) => {
    if (!c.created_at) return false;
    const created = new Date(c.created_at);
    return created >= start && created < endWeek;
  });

  const weekActive = weekContracts.filter((c) => c.status === "active");
  const weekRisk = weekContracts.filter((c) => isAutoAtRisk(c));
  const portfolio = weekContracts.reduce( (sum, c) => sum + (c.final_amount ?? 0), 0);
  const active = weekActive.reduce((sum, c) => sum + (c.final_amount ?? 0), 0);
  const risk = weekRisk.reduce((sum, c) => sum + (c.final_amount ?? 0), 0);
  const avg = weekActive.length === 0 ? 0: weekActive.reduce((sum, c) => sum + (c.progress_percentage ?? 0), 0) / weekActive.length;

  weeks.push({
    label: start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    portfolio,
    active,
    risk,
    avg: Math.round(avg),
  });
}

    // Cumulative for nicer sparkline
    let cumP = 0,
      cumA = 0,
      cumR = 0;
    return weeks.map((w) => {
      cumP += w.portfolio;
      cumA += w.active;
      cumR += w.risk;
      return { label: w.label, portfolio: cumP, active: cumA, risk: cumR, avg: w.avg };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  };

  const firstName = user?.email?.split("@")[0] ?? "there";
  if (hasOrg === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading workspace...
      </div>
    );
  }

  if (!hasOrg) {
    return <OrganizationOnboarding user={user} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-black transition-colors">
      {/* HEADER */}
      <div className="bg-white/80 dark:bg-white/5 backdrop-blur border-b border-gray-200 dark:border-white/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Portfolio Command Center
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Welcome back, {firstName}</p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} setTheme={setTheme} />

            <Link
              href="/audit"
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-100 transition"
              prefetch={false}
            >
              Audit Logs
            </Link>

            <Link
              href="/dashboard/membership-requests"
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-100 transition"
              prefetch={false}
            >
              Membership Requests
            </Link>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-300 border border-red-200/80 dark:border-red-400/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-400/20 transition"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        {/* KPIs */}
        {loading ? (
          <KPISkeleton />
        ) : (
          <motion.div
            className="grid md:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
            }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                title="Total Portfolio Value"
                value={portfolioValue}
                icon={<DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />}
                gradient="from-green-50 to-green-100 dark:from-green-500/10 dark:to-emerald-500/10"
                sparkData={sparklineData}
                sparkKey="portfolio"
                money
              />
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                title="Active Exposure"
                value={activeExposure}
                icon={<TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
                gradient="from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-indigo-500/10"
                sparkData={sparklineData}
                sparkKey="active"
                money
              />
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                title="At Risk Revenue"
                value={atRiskRevenue}
                icon={<AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />}
                gradient="from-red-50 to-red-100 dark:from-red-500/10 dark:to-rose-500/10"
                sparkData={sparklineData}
                sparkKey="risk"
                money
              />
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard
                title="Avg Completion"
                value={avgCompletion}
                icon={<Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
                gradient="from-purple-50 to-purple-100 dark:from-purple-500/10 dark:to-fuchsia-500/10"
                sparkData={sparklineData}
                sparkKey="avg"
                isPercent
                showRing
              />
            </motion.div>
          </motion.div>
        )}

        {/* ATTENTION PANEL */}
        <section className="bg-white dark:bg-white/5 rounded-xl shadow-lg border border-gray-100 dark:border-white/10 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Contracts Requiring Attention
          </h2>

          {loading ? (
            <ListSkeleton count={3} />
          ) : atRiskContracts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">All active contracts are performing normally.</p>
          ) : (
            <AnimatePresence initial={false}>
              {atRiskContracts.map((contract) => (
                <motion.div
                  key={contract.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="border border-red-200/60 dark:border-red-400/20 rounded-xl p-4 mb-3 flex justify-between items-center bg-red-50/60 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                >
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-300">
                      {contract.contract_number || contract.tracking_id}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">Low progress or stale update</p>
                  </div>
                  <Link
                    href={`/contracts/${contract.id}`}
                    className="text-red-700 dark:text-red-300 font-medium hover:underline"
                    prefetch={false}
                  >
                    Review →
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </section>

        {/* ACTIVE CONTRACTS */}
        <section className="bg-white dark:bg-white/5 rounded-xl shadow-lg border border-gray-100 dark:border-white/10">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Active Contracts</h2>
          </div>

          <div className="p-6 space-y-4">
            {loading ? (
              <ListSkeleton count={4} />
            ) : activeContracts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center">No active contracts.</p>
            ) : (
              <AnimatePresence initial={false}>
                {activeContracts.map((contract) => {
                  const burn = calculateBurnMetrics(contract);
                  const progress = contract.progress_percentage || 0;

                  return (
                    <motion.div
                      key={contract.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="border rounded-xl px-6 py-5 hover:shadow-md hover:border-gray-300 dark:hover:border-white/20 transition bg-white dark:bg-white/5"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        {/* MAIN INFO */}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate">
                            {contract.contract_number || contract.tracking_id}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            ${contract.final_amount?.toLocaleString() || "—"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {contract.period_of_performance || "No period set"}
                          </p>
                        </div>

                        {/* PROGRESS RING + STATUS + BURN */}
                        <div className="flex items-center gap-8 ml-auto">
                          <ProgressRing
                            size={72}
                            stroke={8}
                            progress={progress}
                            trackColor="stroke-gray-200 dark:stroke-white/10"
                            progressColor={isAutoAtRisk(contract) ? "stroke-red-500" : "stroke-blue-600"}
                            label={`${progress}%`}
                          />

                          <div className="text-right space-y-2">
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                isAutoAtRisk(contract)
                                  ? "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300"
                              }`}
                            >
                              {isAutoAtRisk(contract) ? "At Risk" : "Active"}
                            </span>

                            {burn && (
                              <div className="mt-2 text-xs space-y-1 text-gray-700 dark:text-gray-200">
                                <FlexRow label="Earned Revenue" value={`$${burn.earnedRevenue.toLocaleString()}`} />
                                <FlexRow label="Expected by Now" value={`$${burn.expectedRevenue.toLocaleString()}`} />
                                <FlexRow
                                  label="Schedule Variance"
                                  value={`${(burn.variance * 100).toFixed(1)}%`}
                                  className={
                                    burn.variance < -0.05
                                      ? "text-red-600 dark:text-red-400"
                                      : burn.variance > 0.05
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-gray-700 dark:text-gray-300"
                                  }
                                />
                              </div>
                            )}

                            <Link
                              href={`/contracts/${contract.id}`}
                              className="inline-block mt-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                              prefetch={false}
                            >
                              Manage
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ===================== Components (unchanged) ===================== */

function ThemeToggle({ theme, setTheme }: { theme?: string; setTheme: (t: string) => void }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-100 transition"
      aria-label="Toggle dark mode"
      title="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"} mode</span>
    </button>
  );
}

function KPISkeleton() {
  return (
    <div className="grid md:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-6 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/0 opacity-50" />
          <div className="animate-pulse relative space-y-3">
            <div className="h-5 w-40 bg-gray-200 dark:bg-white/10 rounded" />
            <div className="h-8 w-28 bg-gray-200 dark:bg-white/10 rounded" />
            <div className="h-16 w-full bg-gray-200 dark:bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-white/5">
          <div className="h-4 w-52 bg-gray-200 dark:bg-white/10 rounded mb-2" />
          <div className="h-3 w-80 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  gradient,
  sparkData,
  sparkKey,
  money,
  isPercent,
  showRing,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  sparkData: any[];
  sparkKey: "portfolio" | "active" | "risk" | "avg";
  money?: boolean;
  isPercent?: boolean;
  showRing?: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="relative bg-white dark:bg-white/5 rounded-xl shadow-md p-5 overflow-hidden group border border-gray-100 dark:border-white/10">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60 group-hover:opacity-80 transition pointer-events-none`} />
      <div className="relative flex items-center gap-4">
        <div className="p-3 rounded-lg bg-white dark:bg-white/10 shadow-sm text-gray-700 dark:text-gray-100">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700/80 dark:text-gray-300/90">{title}</p>

          <AnimatedNumber
            value={value}
            formatter={(n) => (isPercent ? `${n.toFixed(0)}%` : money ? `$${Math.round(n).toLocaleString()}` : `${Math.round(n)}`)}
            className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white"
          />

          {/* Sparkline */}
          <div className="h-14 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              {sparkKey === "avg" ? (
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="avg" stroke="currentColor" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id={`grad-${sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey={sparkKey} stroke="currentColor" fill={`url(#grad-${sparkKey})`} strokeWidth={2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Optional animated ring for % */}
        {showRing && (
          <div className="hidden sm:block">
            <ProgressRing
              size={64}
              stroke={8}
              progress={Math.max(0, Math.min(100, value))}
              label={`${Math.max(0, Math.min(100, value))}%`}
              trackColor="stroke-gray-200 dark:stroke-white/10"
              progressColor="stroke-purple-600"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AnimatedNumber({
  value,
  formatter = (n: number) => n.toFixed(0),
  className = "",
}: {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = animate(display, value, {
      type: "spring",
      stiffness: 120,
      damping: 18,
      duration: 0.6,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <div className={className}>{formatter(display)}</div>;
}

function ProgressRing({
  size = 72,
  stroke = 8,
  progress = 0,
  label,
  trackColor = "stroke-gray-200",
  progressColor = "stroke-blue-600",
}: {
  size?: number;
  stroke?: number;
  progress?: number; // 0..100
  label?: string;
  trackColor?: string;
  progressColor?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(progress, 100));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="overflow-visible">
      <circle cx={size / 2} cy={size / 2} r={radius} className={trackColor} strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={progressColor}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        strokeDasharray={circumference}
      />
      {label && (
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="text-sm fill-gray-900 dark:fill-gray-100 font-semibold">
          {label}
        </text>
      )}
    </svg>
  );
}

function FlexRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={`font-semibold ${className}`}>{value}</span>
    </div>
  );
}
``
