"use client";

type Contract = {
  status: string | null;
  final_amount: number | null;
};

export default function ContractsDashboard({ contracts }: { contracts: Contract[] }) {

  const totalContracts = contracts.length;

  const activeContracts = contracts.filter(
    c => c.status === "active"
  ).length;

  const pendingReview = contracts.filter(
    c => c.status === "pending_review"
  ).length;

  const pendingPayment = contracts.filter(
    c => c.status === "approved"
  ).length;

  const atRisk = contracts.filter(
    c => c.status === "at_risk"
  ).length;

  const portfolioValue = contracts.reduce(
    (sum, c) => sum + (c.final_amount || 0),
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-6">

      <Card title="Total Contracts" value={totalContracts} />

      <Card title="Active" value={activeContracts} />

      <Card title="Pending Review" value={pendingReview} />

      <Card title="Pending Payment" value={pendingPayment} />

      <Card title="At Risk" value={atRisk} />

      <Card
        title="Portfolio Value"
        value={`$${portfolioValue.toLocaleString()}`}
      />

    </div>
  );
}

function Card({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow">

      <div className="text-xs text-gray-500">
        {title}
      </div>

      <div className="mt-1 text-lg font-semibold">
        {value}
      </div>

    </div>
  );
}