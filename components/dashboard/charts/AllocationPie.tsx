'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/Card';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type Row = { name: string; value: number };

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

function AllocationPieBase({ title, data }: { title: string; data: Row[] }) {
  return (
    <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-white">{title}</p>
      {data.length === 0 ? <p className="text-sm text-gray-400">No data available</p> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                {data.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export const AllocationPie = memo(AllocationPieBase);
