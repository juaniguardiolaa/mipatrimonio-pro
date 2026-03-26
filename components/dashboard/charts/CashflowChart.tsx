'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/Card';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Row = { month: string; net: number };

function CashflowChartBase({ data }: { data: Row[] }) {
  return (
    <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-white">Monthly Net Cashflow</p>
      {data.length === 0 ? <p className="text-sm text-gray-400">No data available</p> : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Line type="monotone" dataKey="net" stroke="#22D3EE" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export const CashflowChart = memo(CashflowChartBase);
