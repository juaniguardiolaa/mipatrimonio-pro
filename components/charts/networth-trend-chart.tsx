'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { NetWorthHistoryPoint } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Card } from '@/components/ui/card';

export function NetWorthTrendChart({ data }: { data: NetWorthHistoryPoint[] }) {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold">Evolución de Patrimonio Neto</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
            <Tooltip
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Area type="monotone" dataKey="netWorth" stroke="#4f46e5" fill="#c7d2fe" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
