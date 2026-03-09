'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export function AssetAllocationChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} innerRadius={68} outerRadius={96} dataKey="value" strokeWidth={0}>{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
