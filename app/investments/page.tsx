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

type Position = {
  id: string;
  ticker: string;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  currentPriceUsd: number;
  costBasis: number;
  marketValue: number;
  marketValueUsd: number;
  profitLoss: number;
  roiPercent: number;
};

export default function InvestmentsPage() {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    fetch('/api/pricing/portfolio/demo', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.positions) setPositions(data.positions);
      })
      .catch(() => undefined);
  }, []);

  const totals = useMemo(() => {
    return positions.reduce(
      (acc, row) => {
        acc.invested += row.costBasis;
        acc.current += row.marketValue;
        acc.currentUsd += row.marketValueUsd;
        acc.gain += row.profitLoss;
        return acc;
      },
      { invested: 0, current: 0, currentUsd: 0, gain: 0 },
    );
  }, [positions]);

  const roi = totals.invested > 0 ? (totals.gain / totals.invested) * 100 : 0;

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    positions.forEach((p) => map.set(p.assetType, (map.get(p.assetType) || 0) + p.marketValue));
    const palette = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6'];
    return Array.from(map.entries()).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [positions]);

  const kpis = [
    { title: 'Valor invertido', value: totals.invested, trend: 1.5, icon: CircleDollarSign, currency: 'ARS' },
    { title: 'Valor actual ARS', value: totals.current, trend: 2.8, icon: Landmark, currency: 'ARS' },
    { title: 'Valor actual USD', value: totals.currentUsd, trend: 2.8, icon: Landmark, currency: 'USD' },
    { title: 'Rendimiento %', value: roi, trend: roi, icon: Percent, currency: 'USD' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Investments AR" subtitle="CEDEARs, bonos argentinos, acciones y crypto en ARS/USD" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{kpis.map((k) => <KpiCard key={k.title} {...k} />)}</div>
      <ChartContainer title="Distribución por tipo de activo"><AssetAllocationChart data={byType} /></ChartContainer>

      <DataTable
        title="Tabla avanzada de inversiones"
        columns={[
          { key: 'ticker', label: 'Ticker', sortable: true },
          { key: 'assetType', label: 'Tipo', sortable: true, render: (row) => <Badge variant="primary">{row.assetType}</Badge> },
          { key: 'quantity', label: 'Cantidad', sortable: true },
          { key: 'currentPrice', label: 'Precio ARS', sortable: true, render: (row) => formatCurrency(row.currentPrice, 'ARS') },
          { key: 'currentPriceUsd', label: 'Precio USD', sortable: true, render: (row) => formatCurrency(row.currentPriceUsd, 'USD') },
          { key: 'marketValue', label: 'Valor ARS', sortable: true, render: (row) => formatCurrency(row.marketValue, 'ARS') },
          { key: 'marketValueUsd', label: 'Valor USD', sortable: true, render: (row) => formatCurrency(row.marketValueUsd, 'USD') },
          { key: 'profitLoss', label: 'Ganancia', sortable: true, render: (row) => <Badge variant={row.profitLoss >= 0 ? 'success' : 'danger'}>{formatCurrency(row.profitLoss, 'ARS')}</Badge> },
          { key: 'roiPercent', label: 'ROI', sortable: true, render: (row) => <Badge variant={row.roiPercent >= 0 ? 'success' : 'danger'}>{formatPercent(row.roiPercent)}</Badge> },
        ]}
        rows={positions}
      />

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Motor de valuación activo: CRYPTO (Binance), STOCK/ETF (IOL), CEDEAR (USD * CCL / ratio), BOND (IOL), CASH (nominal). <TrendingUp className="ml-1 inline h-4 w-4 text-primary" />
      </div>
    </div>
  );
}
