'use client';
 
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { DataTable } from '@/components/ui/DataTable';
import { KpiCard } from '@/components/ui/KpiCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import { CircleDollarSign, Landmark, Percent } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { isValidAsset, usePortfolio } from '@/src/hooks/usePortfolio';
 
type RawAsset = {
  id: string;
  symbol: string;
  ticker?: string | null;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  currency: string;
  currentPrice: number | null;
  currentPriceUsd: number | null;
  costBasis: number;
  costBasisArs: number | null;
  marketValue: number;
  marketValueArs: number | null;
  marketValueUsd: number | null;
  profitLoss: number;
  profitLossArs: number | null;
  roiPercent: number | null;
  isRealPrice: boolean;
};
 
type Account = { id: string; name: string; institution: string };
 
export default function InvestmentsPage() {
  const [rawAssets, setRawAssets] = useState<RawAsset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState('STOCK');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
 
  async function loadData() {
    const [assetsRes, accountsRes] = await Promise.all([
      fetch('/api/assets', { cache: 'no-store', credentials: 'include' }),
      fetch('/api/accounts', { cache: 'no-store', credentials: 'include' }),
    ]);
    if (assetsRes.ok) {
      const d = await assetsRes.json();
      setRawAssets(d.assets || []);
    }
    if (accountsRes.ok) {
      const d = await accountsRes.json();
      setAccounts(d.accounts || []);
    }
  }
 
  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);
 
  // ── FIX: derive all position data and totals from the shared usePortfolio
  // hook. Previously this page computed its own totals using costBasisArs /
  // marketValueArs directly from the raw API response, which (a) bypassed the
  // CEDEAR cost-basis fix, and (b) produced numbers that differed from the
  // dashboard because it filtered positions differently.
  const { positions, totals: portfolioTotals } = usePortfolio(rawAssets);
 
  async function onCreateAsset(e: FormEvent) {
    e.preventDefault();
    setError('');

    let purchaseCcl: number | null = null;
    if (assetType === 'CEDEAR') {
      const fxRes = await fetch('/api/fx/ccl', { cache: 'no-store', credentials: 'include' });
      const fxData = await fxRes.json().catch(() => ({}));
      const value = Number((fxData as any).ccl ?? null);
      purchaseCcl = Number.isFinite(value) && value > 0 ? value : null;
    }

    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ symbol, assetType, quantity: Number(quantity), purchasePrice: Number(purchasePrice), purchaseCcl, currency: 'ARS', accountId: accountId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || 'No se pudo crear la inversión.');
      return;
    }
    setSymbol(''); setQuantity(''); setPurchasePrice(''); setAccountId('');
    await loadData();
  }
 
  // ── Totals: only count positions with real market prices ──────────────
  const totals = useMemo(() => {
    const valid = positions.filter(isValidAsset);
    return valid.reduce(
      (acc, p) => ({
        invested: acc.invested + (p.costBasisArs ?? 0),
        gain: acc.gain + (p.profitLossArs ?? 0),
      }),
      { invested: 0, gain: 0 },
    );
  }, [positions]);
 
  const roi =
    totals.invested > 0 ? (totals.gain / totals.invested) * 100 : 0;
 
  // ── Allocation by type chart ──────────────────────────────────────────
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    positions
      .filter(isValidAsset)
      .forEach((p) => map.set(p.assetType, (map.get(p.assetType) || 0) + p.marketValue));
    const palette = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6'];
    return Array.from(map.entries()).map(([name, value], i) => ({
      name,
      value,
      color: palette[i % palette.length],
    }));
  }, [positions]);
 
  // ── Positions missing real prices (need user attention) ──────────────
  const stalePriceCount = positions.filter((p) => !p.isRealPrice).length;
 
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Investments AR"
        subtitle="Creá posiciones y valuá CEDEARs, bonos, acciones y crypto en ARS/USD."
      />
 
      {stalePriceCount > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/20 p-3 text-sm text-amber-200">
          ⚠ {stalePriceCount} posición{stalePriceCount > 1 ? 'es' : ''} sin precio de mercado actualizado.
          Los totales y el ROI solo incluyen posiciones con precio real.
        </div>
      )}
 
      <form
        className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-6"
        onSubmit={onCreateAsset}
      >
        <Input
          placeholder="Ticker (ej: AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          required
        />
        <Select value={assetType} onChange={(e) => setAssetType(e.target.value)}>
          <option value="STOCK">STOCK</option>
          <option value="CEDEAR">CEDEAR</option>
          <option value="BOND">BOND</option>
          <option value="CRYPTO">CRYPTO</option>
          <option value="ETF">ETF</option>
          <option value="CASH">CASH</option>
        </Select>
        <Input
          placeholder="Cantidad"
          type="number"
          min="0.0001"
          step="0.0001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <Input
          placeholder={assetType === 'CEDEAR' ? 'Precio compra (ARS)' : 'Precio compra (USD)'}
          type="number"
          min="0.01"
          step="0.01"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          required
        />
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Sin cuenta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.institution})
            </option>
          ))}
        </Select>
        <Button>Agregar inversión</Button>
        {error ? <p className="md:col-span-6 text-sm text-red-500">{error}</p> : null}
      </form>
 
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Valor invertido (ARS)"
          value={totals.invested}
          trend={1.5}
          icon={CircleDollarSign}
          currency="ARS"
        />
        {/* ── FIX: these now come from the same usePortfolio hook as the
            dashboard, so the numbers will always match ── */}
        <KpiCard
          title="Valor actual ARS"
          value={portfolioTotals.totalArs}
          trend={2.8}
          icon={Landmark}
          currency="ARS"
        />
        <KpiCard
          title="Valor actual USD"
          value={portfolioTotals.totalUsd}
          trend={2.8}
          icon={Landmark}
          currency="USD"
        />
        <KpiCard
          title="Rendimiento %"
          value={roi}
          trend={roi}
          icon={Percent}
          currency="USD"
        />
      </div>
 
      <ChartContainer title="Distribución por tipo de activo">
        <AssetAllocationChart data={byType} />
      </ChartContainer>
 
      <DataTable
        title="Tabla avanzada de inversiones"
        columns={[
          { key: 'ticker', label: 'Ticker', sortable: true },
          {
            key: 'assetType',
            label: 'Tipo',
            sortable: true,
            render: (row) => <Badge variant="primary">{row.assetType}</Badge>,
          },
          { key: 'quantity', label: 'Cantidad', sortable: true },
          { key: 'currentPrice', label: 'Precio ARS', sortable: true, render: (row) => row.currentPrice === null ? '—' : row.isRealPrice ? formatCurrency(row.currentPrice, 'ARS') : `${formatCurrency(row.currentPrice, 'ARS')} ⚠` },
          { key: 'currentPriceUsd', label: 'Precio USD', sortable: true, render: (row) => row.currentPriceUsd === null ? '—' : row.isRealPrice ? formatCurrency(row.currentPriceUsd, 'USD') : `${formatCurrency(row.currentPriceUsd, 'USD')} ⚠ Precio no actualizado` },
          { key: 'marketValueArs', label: 'Valor ARS', sortable: true, render: (row) => row.marketValueArs === null ? '—' : formatCurrency(row.marketValueArs, 'ARS') },
          { key: 'marketValueUsd', label: 'Valor USD', sortable: true, render: (row) => row.marketValueUsd === null ? '—' : formatCurrency(row.marketValueUsd, 'USD') },
          { key: 'profitLossArs', label: 'Ganancia ARS', sortable: true, render: (row) => row.profitLossArs === null ? '—' : <Badge variant={row.profitLossArs >= 0 ? 'success' : 'danger'}>{formatCurrency(row.profitLossArs, 'ARS')}</Badge> },
          { key: 'roiPercent', label: 'ROI', sortable: true, render: (row) => (row.roiPercent === null ? '—' : <Badge variant={row.roiPercent >= 0 ? 'success' : 'danger'}>{formatPercent(row.roiPercent)}</Badge>) },
        ]}
        rows={positions}
      />

      {(() => {
        const bondCount = positions.filter((position) => position.assetType === 'BOND').length;
        const otherStaleCount = positions.filter((position) => !position.isRealPrice && position.assetType !== 'BOND').length;
        return (
          <div className="space-y-2">
            {bondCount > 0 ? <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-700">⚠ {bondCount} bono{bondCount > 1 ? 's' : ''} valorizado{bondCount > 1 ? 's' : ''} a precio de compra (sin feed de precios de mercado).</div> : null}
            {otherStaleCount > 0 ? <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-700">⚠ {otherStaleCount} posición{otherStaleCount > 1 ? 'es' : ''} sin precio de mercado actualizado.</div> : null}
          </div>
        );
      })()}
    </div>
  );
}
 
