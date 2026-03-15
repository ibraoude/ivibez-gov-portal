"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const COLORS = ["#2563eb","#22c55e","#f59e0b","#ef4444"];

export default function ContractStatusChart({ data }:{ data:any[] }) {

  return(

    <div className="bg-white rounded-xl border shadow p-6">

      <h2 className="text-lg font-semibold mb-4">
        Contract Status
      </h2>

      <ResponsiveContainer width="100%" height={300}>

        <PieChart>

          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={100}
          >

            {data.map((entry,index)=>(
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}

          </Pie>

          <Tooltip />

        </PieChart>

      </ResponsiveContainer>

    </div>

  );
}