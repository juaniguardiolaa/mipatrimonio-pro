'use client';

import { formatCurrency } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function NetWorthTrendChart({ data }: { data: { month: string; value: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs><linearGradient id="net" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Area type="monotone" dataKey="value" stroke="#2563EB" fill="url(#net)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
