
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from 'recharts';

/* =========================
   Types — keep columns intact
   ========================= */
type Contract = {
  id: string;
  title: string;
  status: string;
  gov_type: string;
  final_amount: number;
  created_at: string;
  updated_at: string;
};

/* =========================
   Helpers
   ========================= */
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#94a3b8'];

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Return a key like "2026-01" to sort months chronologically across years. */
function yearMonthKey(dateIso: string) {
  const d = new Date(dateIso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Format a year-month key to a short label like "Jan 2026". */
function labelFromYearMonthKey(key: string) {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, 1);
  return dt.toLocaleString('default', { month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS = ['active', 'completed', 'cancelled', 'on_hold', 'pending'] as const;

/* =========================
   Page
   ========================= */
export default function AnalyticsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters (optional, client-side)
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [govTypeFilter, setGovTypeFilter] = useState<string>('all');

  useEffect(() => {
    void loadContracts();
  }, []);

  async function loadContracts() {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from('contracts')
      .select('*'); // keep as-is per your schema

    if (error) {
      console.error(error);
      setLoadError(error.message || 'Failed to load contracts.');
      setContracts([]);
    } else {
      setContracts(data ?? []);
    }

    setLoading(false);
  }

  /** Apply client-side filters (status + gov_type). */
  const visibleContracts = useMemo(() => {
    return contracts.filter((c) => {
      const okStatus = statusFilter === 'all' ? true : c.status === statusFilter;
      const okGov = govTypeFilter === 'all' ? true : c.gov_type === govTypeFilter;
      return okStatus && okGov;
    });
  }, [contracts, statusFilter, govTypeFilter]);

  /* =========================
     KPI CALCULATIONS (memo)
     ========================= */
  const { totalContracts, activeContracts, totalValue, completionRate } = useMemo(() => {
    const total = visibleContracts.length;
    const active = visibleContracts.filter((c) => c.status === 'active').length;
    const value = visibleContracts.reduce((sum, c) => sum + (c.final_amount || 0), 0);
    const completion =
      total > 0
        ? Math.round((visibleContracts.filter((c) => c.status === 'completed').length / total) * 100)
        : 0;

    return {
      totalContracts: total,
      activeContracts: active,
      totalValue: value,
      completionRate: completion,
    };
  }, [visibleContracts]);

  /* =========================
     STATUS DISTRIBUTION (memo)
     ========================= */
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of visibleContracts) {
      map.set(c.status, (map.get(c.status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [visibleContracts]);

  /* =========================
     GOV TYPE BREAKDOWN (memo)
     ========================= */
  const govData = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of visibleContracts) {
      map.set(c.gov_type, (map.get(c.gov_type) ?? 0) + (c.final_amount || 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [visibleContracts]);

  /* =========================
     REVENUE TREND (Monthly, memo)
     ========================= */
  const revenueData = useMemo(() => {
    const map = new Map<string, number>(); // key = "YYYY-MM"
    for (const c of visibleContracts) {
      const k = yearMonthKey(c.created_at);
      map.set(k, (map.get(k) ?? 0) + (c.final_amount || 0));
    }
    const sortedKeys = Array.from(map.keys()).sort(); // lexicographic works for YYYY-MM
    return sortedKeys.map((k) => ({ month: labelFromYearMonthKey(k), revenue: map.get(k)! }));
  }, [visibleContracts]);

  /* =========================
     Unique filters (memo)
     ========================= */
  const distinctStatuses = useMemo(() => {
    const set = new Set<string>(contracts.map((c) => c.status).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [contracts]);

  const distinctGovTypes = useMemo(() => {
    const set = new Set<string>(contracts.map((c) => c.gov_type).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [contracts]);

  /* =========================
     Rendering
     ========================= */
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard / Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <SkeletonPanel />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonPanel />
            <SkeletonPanel />
          </div>
          <SkeletonTable />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Dashboard / Analytics</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="font-semibold">Could not load analytics</div>
          <div className="text-sm">{loadError}</div>
          <button
            onClick={loadContracts}
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-white shadow hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard / Analytics</h1>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-gray-700">No contracts found.</div>
          <div className="text-sm text-gray-500">Add contracts to see analytics.</div>
          <button
            onClick={loadContracts}
            className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard / Analytics</h1>
          <p className="text-sm text-gray-500">Key performance indicators and trends across your contracts.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm shadow-sm"
            aria-label="Filter by Status"
          >
            {distinctStatuses.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s}
              </option>
            ))}
          </select>

          <select
            value={govTypeFilter}
            onChange={(e) => setGovTypeFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm shadow-sm"
            aria-label="Filter by Government Type"
          >
            {distinctGovTypes.map((g) => (
              <option key={g} value={g}>
                {g === 'all' ? 'All Gov Types' : g}
              </option>
            ))}
          </select>

          {(statusFilter !== 'all' || govTypeFilter !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setGovTypeFilter('all');
              }}
              className="rounded-md border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <KpiCard title="Total Contracts" value={totalContracts.toLocaleString()} color="bg-blue-50" />
        <KpiCard title="Active Contracts" value={activeContracts.toLocaleString()} color="bg-green-50" />
        <KpiCard title="Total Value" value={currency.format(totalValue)} color="bg-purple-50" />
        <KpiCard title="Completion Rate" value={`${completionRate}%`} color="bg-orange-50" />
      </div>

      {/* ================= REVENUE TREND ================= */}
      <Panel title="Revenue Trend (Monthly)">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={revenueData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#eee" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v) => currency.format(v).replace('$', '$ ')} />
            <Tooltip formatter={(val: any) => currency.format(val)} />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* ================= STATUS DONUT ================= */}
        <Panel title="Contract Status Distribution">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label={({ name, value }) => `${name} (${value})`}
                isAnimationActive={false}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        {/* ================= GOV TYPE BAR ================= */}
        <Panel title="Revenue by Gov Type">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={govData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => currency.format(v).replace('$', '$ ')} />
              <Tooltip formatter={(val: any) => currency.format(val)} />
              <Legend />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ================= RECENT CONTRACTS ================= */}
      <Panel title="Recent Contracts">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Gov Type</th>
                <th className="py-2 pr-2">Amount</th>
                <th className="py-2 pr-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleContracts
                .slice()
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 8)
                .map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-2">{c.title}</td>
                    <td className="py-2 pr-2">{c.status}</td>
                    <td className="py-2 pr-2">{c.gov_type}</td>
                    <td className="py-2 pr-2">{currency.format(c.final_amount ?? 0)}</td>
                    <td className="py-2 pr-2">
                      {new Date(c.updated_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              {visibleContracts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No contracts match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* =========================
   Reusable Components
   ========================= */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className={`${color} rounded-xl border p-6 shadow-sm`}>
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-xl bg-gray-100" />;
}
function SkeletonPanel() {
  return <div className="h-80 animate-pulse rounded-xl bg-gray-100" />;
}
function SkeletonTable() {
  return <div className="h-64 animate-pulse rounded-xl bg-gray-100" />;
}
