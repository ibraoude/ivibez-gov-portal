//app/(protected)/vendor/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedPage from "@/components/auth/ProtectedPage";
import { createClient } from "@/lib/supabase/client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";



const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function VendorDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    activeContracts: 0,
    pendingDeliverables: 0,
    paymentsPending: 0,
    totalEarned: 0,
    revenueThisMonth: 0,
    contractsCompleted: 0,
    avgContractValue: 0,
  });

  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [upcomingDeliverables, setUpcomingDeliverables] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [contractStatus, setContractStatus] = useState<any[]>([]);
  const [contractsByGov, setContractsByGov] = useState<any[]>([]);
  const [revenueByGov, setRevenueByGov] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    function checkError(error: any, label: string) {
    if (error) {
      console.error(`Dashboard query failed: ${label}`, error);
      throw new Error(
        error.message || `Dashboard query failed: ${label}`
      );
    }
  }
  try {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const vendorId = user.id;

    /* CONTRACT COUNTS */

    const { count: activeContracts, error: activeContractsError } = await supabase
      .from("contracts")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("status", "active");

    checkError(activeContractsError, "activeContracts");

    const { count: pendingDeliverables, error: pendingDeliverablesError } = await supabase
      .from("contracts")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("completion_status", "not_submitted")
      .eq("status", "active");

    checkError(pendingDeliverablesError, "pendingDeliverables");

    const { count: contractsCompleted, error: contractsCompletedError } = await supabase
      .from("contracts")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .eq("status", "completed");

    checkError(contractsCompletedError, "contractsCompleted");

    /* PAYMENTS */

    const { data: pendingPayments, error: pendingPaymentsError } = await supabase
      .from("contract_payments")
      .select("amount")
      .eq("vendor_id", vendorId)
      .eq("payment_status", "pending");

    checkError(pendingPaymentsError, "pendingPayments");

    const paymentsPending =
      pendingPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    const { data: paidPayments, error: paidPaymentsError } = await supabase
      .from("contract_payments")
      .select("amount,created_at")
      .eq("vendor_id", vendorId)
      .eq("payment_status", "paid");

    checkError(paidPaymentsError, "paidPayments");

    const totalEarned =
      paidPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    /* REVENUE THIS MONTH */

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const revenueThisMonth =
      paidPayments?.reduce((sum, p) => {
        if (!p.created_at) return sum;

        const d = new Date(p.created_at);

        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          return sum + (p.amount || 0);
        }

        return sum;
      }, 0) || 0;

    /* AVERAGE CONTRACT VALUE */

    const { data: contracts, error: contractsError } = await supabase
      .from("contracts")
      .select("final_amount")
      .eq("vendor_id", vendorId);

    checkError(contractsError, "contracts");

    const avgContractValue =
      contracts && contracts.length
        ? contracts.reduce((sum, c) => sum + (c.final_amount || 0), 0) /
          contracts.length
        : 0;

    /* RECENT PAYMENTS */

    const { data: recent, error: recentError } = await supabase
      .from("contract_payments")
      .select("amount,created_at,payment_status")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(5);

    checkError(recentError, "recentPayments");

    setRecentPayments(recent || []);

    /* UPCOMING DELIVERABLES */

    const { data: deliverables, error: deliverablesError } = await supabase
      .from("contracts")
      .select("title,period_end,completion_status")
      .eq("vendor_id", vendorId)
      .eq("status", "active")
      .order("period_end", { ascending: true })
      .limit(5);

    checkError(deliverablesError, "upcomingDeliverables");

    setUpcomingDeliverables(deliverables || []);

    /* MONTHLY REVENUE */

    const revenueByMonth: Record<string, number> = {};

    paidPayments?.forEach((p) => {
      if (!p.created_at) return;

      const d = new Date(p.created_at);
      const label = d.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      });

      revenueByMonth[label] = (revenueByMonth[label] || 0) + (p.amount || 0);
    });

    setMonthlyRevenue(
      Object.entries(revenueByMonth).map(([month, revenue]) => ({
        month,
        revenue,
      }))
    );

    /* CONTRACT STATUS */

    const { data: statuses, error: statusesError } = await supabase
      .from("contracts")
      .select("status")
      .eq("vendor_id", vendorId);

    checkError(statusesError, "contractStatus");

    const statusCounts: Record<string, number> = {};

    statuses?.forEach((s) => {
      const name = s.status || "unknown";
      statusCounts[name] = (statusCounts[name] || 0) + 1;
    });

    setContractStatus(
      Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
      }))
    );

    /* GOV ANALYTICS */

    const { data: govContracts, error: govContractsError } = await supabase
      .from("contracts")
      .select("gov_type,final_amount")
      .eq("vendor_id", vendorId);

    checkError(govContractsError, "govContracts");

    const govCounts: Record<string, number> = {};
    const govRevenue: Record<string, number> = {};

    govContracts?.forEach((c) => {
      const type = c.gov_type || "unknown";

      govCounts[type] = (govCounts[type] || 0) + 1;
      govRevenue[type] = (govRevenue[type] || 0) + (c.final_amount || 0);
    });

    setContractsByGov(
      Object.entries(govCounts).map(([name, value]) => ({
        name,
        value,
      }))
    );

    setRevenueByGov(
      Object.entries(govRevenue).map(([name, value]) => ({
        name,
        value,
      }))
    );

    setStats({
      activeContracts: activeContracts || 0,
      pendingDeliverables: pendingDeliverables || 0,
      paymentsPending,
      totalEarned,
      revenueThisMonth,
      contractsCompleted: contractsCompleted || 0,
      avgContractValue,
    });

      } catch (error: any) {
        console.error("Vendor dashboard failed:", error);
        setPageError(error?.message || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

  const hasCharts = useMemo(
    () => monthlyRevenue.length || contractStatus.length,
    [monthlyRevenue, contractStatus]
  );

  return (
    <ProtectedPage permission="viewDashboard">
      <main className="p-6 space-y-10">
        <h1 className="text-2xl font-semibold">Vendor Dashboard</h1>

        {pageError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {/* KPI CARDS */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Active Contracts" value={stats.activeContracts} />
          <Card title="Pending Deliverables" value={stats.pendingDeliverables} />
          <Card title="Payments Pending" value={currency(stats.paymentsPending)} />
          <Card title="Total Earned" value={currency(stats.totalEarned)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Revenue This Month" value={currency(stats.revenueThisMonth)} />
          <Card title="Contracts Completed" value={stats.contractsCompleted} />
          <Card title="Average Contract Value" value={currency(stats.avgContractValue)} />
        </div>

        {/* CHARTS */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* MONTHLY REVENUE */}

          <ChartCard title="Monthly Revenue">

            <ResponsiveContainer width="100%" height={300}>

              <LineChart data={monthlyRevenue}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="month" />

                <YAxis />

                <Tooltip formatter={(value)=>currency(Number(value))}/>

                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                />

              </LineChart>

            </ResponsiveContainer>

          </ChartCard>


          {/* CONTRACT STATUS */}

          <ChartCard title="Contract Status">

            <ResponsiveContainer width="100%" height={300}>

              <PieChart>

                <Pie data={contractStatus} dataKey="value" nameKey="name" outerRadius={100}>

                  {contractStatus.map((entry,index)=>(
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]}/>
                  ))}

                </Pie>

                <Tooltip/>

              </PieChart>

            </ResponsiveContainer>

          </ChartCard>


          {/* CONTRACTS BY GOV TYPE */}

          <ChartCard title="Contracts by Government Type">

            <ResponsiveContainer width="100%" height={300}>

              <PieChart>

                <Pie data={contractsByGov} dataKey="value" nameKey="name" outerRadius={100}>

                  {contractsByGov.map((entry,index)=>(
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]}/>
                  ))}

                </Pie>

                <Tooltip/>
                <Legend/>

              </PieChart>

            </ResponsiveContainer>

          </ChartCard>


          {/* REVENUE BY GOV TYPE */}

          <ChartCard title="Revenue by Government Type">

            <ResponsiveContainer width="100%" height={300}>

              <BarChart data={revenueByGov}>

                <CartesianGrid strokeDasharray="3 3"/>

                <XAxis dataKey="name"/>

                <YAxis/>

                <Tooltip formatter={(value)=>currency(Number(value))}/>

                <Bar dataKey="value" fill="#2563eb" radius={[6,6,0,0]}/>

              </BarChart>

            </ResponsiveContainer>

          </ChartCard>

        </div>

        {/* TABLES */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <DataTable
            title="Recent Payments"
            headers={["Date","Amount","Status"]}
            rows={recentPayments.map(p=>[
              p.created_at ? new Date(p.created_at).toLocaleDateString() : "-",
              currency(p.amount || 0),
              p.payment_status || "-"
            ])}
          />

          <DataTable
            title="Upcoming Deliverables"
            headers={["Contract","Due Date","Status"]}
            rows={upcomingDeliverables.map(d=>[
              d.title || "Untitled",
              d.period_end ? new Date(d.period_end).toLocaleDateString() : "-",
              d.completion_status || "-"
            ])}
          />

        </div>

      </main>
    </ProtectedPage>
  );
}


/* COMPONENTS */

function Card({title,value}:{title:string,value:any}){

  return(
    <div className="bg-white rounded-xl border p-4 shadow hover:shadow-md transition">

      <p className="text-sm text-gray-500">{title}</p>

      <p className="text-xl font-semibold mt-1">{value}</p>

    </div>
  );
}


function ChartCard({title,children}:{title:string,children:any}){

  return(
    <div className="bg-white rounded-xl border shadow p-6">

      <h2 className="text-lg font-semibold mb-4">{title}</h2>

      {children}

    </div>
  );
}


function DataTable({title,headers,rows}:{title:string,headers:string[],rows:any[][]}){

  return(

    <div className="bg-white border rounded-xl shadow">

      <div className="p-4 border-b font-semibold">{title}</div>

      <table className="w-full text-sm">

        <thead className="bg-gray-50">

          <tr>

            {headers.map(h=>(
              <th key={h} className="p-3 text-left">{h}</th>
            ))}

          </tr>

        </thead>

        <tbody>

          {rows.map((r,i)=>(
            <tr key={i} className="border-t">

              {r.map((c,j)=>(
                <td key={j} className="p-3">{c}</td>
              ))}

            </tr>
          ))}

        </tbody>

      </table>

    </div>

  );
}