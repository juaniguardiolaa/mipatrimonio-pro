'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

const COLORS = ['#4f46e5', '#2563eb', '#0891b2', '#7c3aed', '#0f766e', '#f59e0b'];

export function CategoryAllocationChart({
  data,
  title
}: {
  data: { name: string; value: number }[];
  title: string;
}) {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
