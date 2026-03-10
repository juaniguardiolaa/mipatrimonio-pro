'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { DataTable } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';
import { IncomeVsExpensesChart } from '@/components/charts/IncomeVsExpensesChart';
import { NetWorthTrendChart } from '@/components/charts/NetWorthTrendChart';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Position = { id: string; symbol: string; costBasis: number; marketValue: number; profitLoss: number; roiPercent: number };

const trend = [
  { month: 'Jan', value: 1020000 }, { month: 'Feb', value: 1070000 }, { month: 'Mar', value: 1110000 }, { month: 'Apr', value: 1175000 }, { month: 'May', value: 1212000 }, { month: 'Jun', value: 1284450 },
];
const allocation = [
  { name: 'Equity', value: 48, color: '#2563EB' }, { name: 'Cash', value: 24, color: '#10B981' }, { name: 'Real Estate', value: 17, color: '#F59E0B' }, { name: 'Crypto', value: 11, color: '#8B5CF6' },
];
const ie = [
  { month: 'Apr', income: 11800, expenses: 6300 }, { month: 'May', income: 12100, expenses: 6100 }, { month: 'Jun', income: 12550, expenses: 6450 },
];

export default function DashboardPage() {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    fetch('/api/pricing/update', { cache: 'no-store' }).catch(() => undefined);
    fetch('/api/pricing/portfolio/demo', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.positions) setPositions(data.positions);
      })
      .catch(() => undefined);
  }, []);

  const totals = useMemo(() => {
    return positions.reduce((acc, p) => {
      acc.costBasis += p.costBasis;
      acc.market += p.marketValue;
      acc.pnl += p.profitLoss;
      return acc;
    }, { costBasis: 0, market: 0, pnl: 0 });
  }, [positions]);

  const roi = totals.costBasis > 0 ? (totals.pnl / totals.costBasis) * 100 : 0;

  const kpis = [
    { title: 'Net Worth', value: totals.market, trend: roi, icon: Landmark },
    { title: 'Total Assets', value: totals.market, trend: 2.7, icon: Wallet },
    { title: 'Total Liabilities', value: 257650.73, trend: -1.1, icon: TrendingDown },
    { title: 'Monthly Change', value: totals.pnl, trend: roi, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Financial Dashboard" subtitle="Valuación automática en tiempo real para portfolio." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{kpis.map((k) => <KpiCard key={k.title} {...k} />)}</div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartContainer title="Net Worth Trend"><NetWorthTrendChart data={trend} /></ChartContainer>
        <ChartContainer title="Asset Allocation"><AssetAllocationChart data={allocation} /></ChartContainer>
        <ChartContainer title="Income vs Expenses"><IncomeVsExpensesChart data={ie} /></ChartContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardTitle>Valor actual portfolio</CardTitle><p className="mt-3 text-2xl font-bold">{formatCurrency(totals.market)}</p></Card>
        <Card><CardTitle>Ganancia/Pérdida</CardTitle><p className="mt-3 text-2xl font-bold">{formatCurrency(totals.pnl)}</p></Card>
        <Card><CardTitle>ROI</CardTitle><p className="mt-3 text-2xl font-bold">{roi.toFixed(2)}%</p></Card>
      </div>

      <Alert title="Portfolio Insight">Las posiciones se refrescan con cache de 60 segundos para evitar rate limits.</Alert>

      <DataTable
        title="Posiciones recientes"
        columns={[
          { key: 'symbol', label: 'Ticker', sortable: true },
          { key: 'marketValue', label: 'Valor actual', sortable: true, render: (row) => formatCurrency(row.marketValue) },
          { key: 'profitLoss', label: 'Ganancia/pérdida', sortable: true, render: (row) => <Badge variant={row.profitLoss >= 0 ? 'success' : 'danger'}>{formatCurrency(row.profitLoss)}</Badge> },
          { key: 'roiPercent', label: 'ROI', sortable: true, render: (row) => <Badge variant={row.roiPercent >= 0 ? 'success' : 'danger'}>{row.roiPercent.toFixed(2)}%</Badge> },
        ]}
        rows={positions}
      />
    </div>
  );
}
