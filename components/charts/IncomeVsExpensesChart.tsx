'use client';

import { formatCurrency } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function IncomeVsExpensesChart({ data }: { data: { month: string; income: number; expenses: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey="income" fill="#10B981" radius={[8, 8, 0, 0]} />
          <Bar dataKey="expenses" fill="#EF4444" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
