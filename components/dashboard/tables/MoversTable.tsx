'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatPercent } from '@/lib/utils';

type Mover = {
  id: string;
  symbol: string;
  marketValueUsd: number | null;
  profitLossUsd: number | null;
  roiPercent: number;
};

function MoversTableBase({ title, type, rows }: { title: string; type: 'gainer' | 'loser'; rows: Mover[] }) {
  return (
    <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-white">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-gray-400">No data available</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-200">
            <thead>
              <tr className="border-b border-gray-700 text-left text-gray-400">
                <th className="py-2">Asset</th>
                <th className="py-2">Value (USD)</th>
                <th className="py-2">PnL (USD)</th>
                <th className="py-2">ROI %</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 last:border-b-0">
                  <td className="py-2">{row.symbol}</td>
                  <td className="py-2">{row.marketValueUsd === null ? '—' : formatCurrency(row.marketValueUsd, 'USD')}</td>
                  <td className={`py-2 ${((row.profitLossUsd ?? 0) >= 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.profitLossUsd === null ? '—' : formatCurrency(row.profitLossUsd, 'USD')}
                  </td>
                  <td className="py-2">{formatPercent(row.roiPercent)}</td>
                  <td className="py-2">
                    <Badge variant={type === 'gainer' ? 'success' : 'danger'}>{type === 'gainer' ? 'Gainer' : 'Loser'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export const MoversTable = memo(MoversTableBase);
