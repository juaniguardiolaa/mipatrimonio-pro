'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import type { PortfolioNetWorth } from '@/types';

export function PortfolioNetWorthChart({ data }: { data: PortfolioNetWorth[] }) {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold">Patrimonio por Portfolio</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="portfolioName" />
            <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="netWorth" fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
