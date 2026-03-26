'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { DataTable } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';
import { NetWorthTrendChart } from '@/components/charts/NetWorthTrendChart';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Landmark, TrendingUp, Wallet, WalletCards } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { isValidAsset, usePortfolio } from '@/src/hooks/usePortfolio';

type Position = {
  id: string;
  symbol: string;
  ticker?: string | null;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  currency: string;
  marketValue: number;
  marketValueArs: number | null;
  marketValueUsd: number | null;
  profitLoss: number;
  profitLossArs: number | null;
  roiPercent: number;
  isRealPrice: boolean;
};

const usdTrend = [
  { month: 'Jan', value: 102000 },
  { month: 'Feb', value: 105400 },
  { month: 'Mar', value: 107300 },
  { month: 'Apr', value: 112200 },
  { month: 'May', value: 116500 },
  { month: 'Jun', value: 121400 },
];

export default function DashboardPage() {
  const [assets, setAssets] = useState<Position[]>([]);
  const [netWorthArs, setNetWorthArs] = useState(0);
  const [netWorthUsd, setNetWorthUsd] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState<'ARS' | 'USD'>('ARS');

  const fetchAssets = useCallback(async () => {
    const res = await fetch('/api/assets', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) return;

    const data = await res.json();
    setAssets(data.assets || []);
  }, []);

  const { positions, totals: portfolioTotals } = usePortfolio(assets);

  useEffect(() => {
    fetchAssets().catch(() => undefined);
  }, [fetchAssets]);

  useEffect(() => {
    const ars = portfolioTotals.totalArs;
    const usd = portfolioTotals.totalUsd;
    setNetWorthArs(ars);
    setNetWorthUsd(usd);
  }, [portfolioTotals.totalArs, portfolioTotals.totalUsd]);

  const totals = useMemo(() => {
    return positions.filter((position) => isValidAsset(position)).reduce((acc, p) => {
      acc.pnl += p.profitLoss;
      return acc;
    }, { pnl: 0 });
  }, [positions]);

  const allocationByType = useMemo(() => {
    const map = new Map<string, number>();
    positions.filter((position) => isValidAsset(position))
      .forEach((p) => map.set(p.assetType, (map.get(p.assetType) || 0) + p.marketValue));
    const palette = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
    return Array.from(map.entries()).map(([name, value], idx) => ({ name, value, color: palette[idx % palette.length] }));
  }, [positions]);

  const allocationByCurrency = useMemo(() => {
    const validPositions = positions.filter((position) => isValidAsset(position));
    const ars = validPositions.reduce((sum, p) => sum + (p.marketValueArs ?? 0), 0);
    const usdArs = validPositions.reduce((sum, p) => sum + (p.marketValueUsd ?? 0), 0);
    return [
      { name: 'ARS', value: ars, color: '#2563EB' },
      { name: 'USD', value: usdArs * 1200, color: '#10B981' },
    ];
  }, [positions]);

  const visibleNetWorth = baseCurrency === 'USD' ? netWorthUsd : netWorthArs;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard Argentina"
        subtitle="Patrimonio real en ARS y USD con soporte CEDEAR/BONOS/FX"
        actions={<div className="flex items-center gap-2"><Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value as 'ARS' | 'USD')}><option value="ARS">ARS</option><option value="USD">USD</option></Select></div>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Patrimonio Total ARS" value={netWorthArs} trend={2.9} icon={Landmark} currency="ARS" />
        <KpiCard title="Patrimonio Total USD" value={netWorthUsd} trend={2.9} icon={Wallet} currency="USD" />
        <KpiCard title="Variación diaria" value={totals.pnl} trend={1.4} icon={TrendingUp} currency={baseCurrency} />
        <KpiCard title="Variación mensual" value={visibleNetWorth * 0.043} trend={4.3} icon={WalletCards} currency={baseCurrency} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartContainer title="Evolución del patrimonio en USD"><NetWorthTrendChart data={usdTrend} /></ChartContainer>
        <ChartContainer title="Distribución por tipo de activo"><AssetAllocationChart data={allocationByType} /></ChartContainer>
        <ChartContainer title="Distribución por moneda"><AssetAllocationChart data={allocationByCurrency} /></ChartContainer>
      </div>

      <DataTable
        title="Posiciones destacadas"
        columns={[
          { key: 'symbol', label: 'Ticker', sortable: true },
          { key: 'assetType', label: 'Tipo', sortable: true, render: (row) => <Badge variant="primary">{row.assetType}</Badge> },
          { key: 'marketValueArs', label: 'Valor ARS', sortable: true, render: (row) => row.marketValueArs === null ? '—' : formatCurrency(row.marketValueArs, 'ARS') },
          { key: 'marketValueUsd', label: 'Valor USD', sortable: true, render: (row) => row.marketValueUsd === null ? '—' : formatCurrency(row.marketValueUsd, 'USD') },
          { key: 'isRealPrice', label: 'Estado precio', sortable: true, render: (row) => row.isRealPrice ? <Badge variant="success">Market</Badge> : <Badge variant="warning">⚠ Fallback</Badge> },
          { key: 'profitLossArs', label: 'Ganancia ARS', sortable: true, render: (row) => row.profitLossArs === null ? '—' : <Badge variant={row.profitLossArs >= 0 ? 'success' : 'danger'}>{formatCurrency(row.profitLossArs, 'ARS')}</Badge> },
          { key: 'roiPercent', label: 'ROI', sortable: true, render: (row) => <Badge variant={row.roiPercent >= 0 ? 'success' : 'danger'}>{row.roiPercent.toFixed(2)}%</Badge> },
        ]}
        rows={positions}
      />
    </div>
  );
}
