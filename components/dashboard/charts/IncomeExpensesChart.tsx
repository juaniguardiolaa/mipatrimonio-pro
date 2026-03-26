'use client';

import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';

type Row = { month: string; income: number; expenses: number };

function IncomeExpensesChartBase({ data }: { data: Row[] }) {
  return (
    <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-white">Income vs Expenses</p>
      {data.length === 0 ? <p className="text-sm text-gray-400">No data available</p> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export const IncomeExpensesChart = memo(IncomeExpensesChartBase);
