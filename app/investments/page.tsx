'use client';

import { useEffect, useMemo, useState } from 'react';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { DataTable } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { CircleDollarSign, Landmark, Percent, TrendingUp } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

type Position = {
  id: string;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  costBasis: number;
  marketValue: number;
  profitLoss: number;
  roiPercent: number;
};

const distribution = [
  { name: 'ETF', value: 50, color: '#2563EB' },
  { name: 'Stocks', value: 30, color: '#10B981' },
  { name: 'CEDEAR', value: 12, color: '#F59E0B' },
  { name: 'Crypto', value: 8, color: '#8B5CF6' },
];

export default function InvestmentsPage() {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    fetch('/api/pricing/portfolio/demo', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.positions) {
          setPositions(data.positions);
        }
      })
      .catch(() => undefined);
  }, []);

  const totals = useMemo(() => {
    return positions.reduce(
      (acc, row) => {
        acc.invested += row.costBasis;
        acc.current += row.marketValue;
        acc.gain += row.profitLoss;
        return acc;
      },
      { invested: 0, current: 0, gain: 0 },
    );
  }, [positions]);

  const roi = totals.invested > 0 ? (totals.gain / totals.invested) * 100 : 0;

  const kpis = [
    { title: 'Valor invertido', value: totals.invested, trend: 1.5, icon: CircleDollarSign },
    { title: 'Valor actual', value: totals.current, trend: 2.8, icon: Landmark },
    { title: 'Ganancia/Pérdida', value: totals.gain, trend: roi, icon: TrendingUp },
    { title: 'Rendimiento %', value: roi, trend: 0.7, icon: Percent },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Investments" subtitle="Precios en tiempo real y rendimiento de posiciones." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{kpis.map((k) => <KpiCard key={k.title} {...k} />)}</div>
      <ChartContainer title="Portfolio Distribution"><AssetAllocationChart data={distribution} /></ChartContainer>

      {positions.length === 0 ? (
        <EmptyState icon={Landmark} title="No hay inversiones registradas" description="Agrega posiciones para ver valuación, P&L y ROI en tiempo real." actionLabel="Agregar inversión" />
      ) : (
        <DataTable
          title="Open Positions"
          columns={[
            { key: 'symbol', label: 'Ticker', sortable: true },
            { key: 'quantity', label: 'Cantidad', sortable: true },
            { key: 'purchasePrice', label: 'Precio Promedio', sortable: true, render: (row) => formatCurrency(row.purchasePrice) },
            { key: 'currentPrice', label: 'Precio Actual', sortable: true, render: (row) => formatCurrency(row.currentPrice) },
            { key: 'marketValue', label: 'Valor Total', sortable: true, render: (row) => formatCurrency(row.marketValue) },
            { key: 'profitLoss', label: 'Ganancia', sortable: true, render: (row) => <Badge variant={row.profitLoss >= 0 ? 'success' : 'danger'}>{formatCurrency(row.profitLoss)}</Badge> },
            { key: 'roiPercent', label: 'ROI', sortable: true, render: (row) => <Badge variant={row.roiPercent >= 0 ? 'success' : 'danger'}>{formatPercent(row.roiPercent)}</Badge> },
          ]}
          rows={positions}
        />
      )}
    </div>
  );
}
