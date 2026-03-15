"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function RevenueChart({ data }: { data: any[] }) {

  return (

    <div className="bg-white rounded-xl border shadow p-6">

      <h2 className="text-lg font-semibold mb-4">
        Monthly Revenue
      </h2>

      <ResponsiveContainer width="100%" height={300}>

        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="month" />

          <YAxis />

          <Tooltip formatter={(value:any)=>`$${value.toLocaleString()}`} />

          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#2563eb"
            strokeWidth={3}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>

  );
}