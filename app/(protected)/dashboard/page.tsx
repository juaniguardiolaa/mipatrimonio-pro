'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CategoryAllocationChart } from '@/components/charts/category-allocation-chart';
import { NetWorthTrendChart } from '@/components/charts/networth-trend-chart';
import { PortfolioNetWorthChart } from '@/components/charts/portfolio-networth-chart';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { AssetForm } from '@/components/forms/asset-form';
import { LiabilityForm } from '@/components/forms/liability-form';
import { BrokerConnectForm } from '@/components/forms/broker-connect-form';
import { Card } from '@/components/ui/card';
import type { Asset, Liability, NetWorthHistoryPoint, NetWorthSummary, PortfolioNetWorth } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

interface DashboardSummaryResponse extends NetWorthSummary {
  byPortfolio: PortfolioNetWorth[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [history, setHistory] = useState<NetWorthHistoryPoint[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; portfolioId: string }[]>([]);
  const [catalog, setCatalog] = useState<{
    assetCategories: { id: string; name: string }[];
    liabilityCategories: { id: string; name: string }[];
    currencies: { code: string; name: string }[];
  }>({ assetCategories: [], liabilityCategories: [], currencies: [] });
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedPortfolioId !== 'all' ? `?portfolioId=${selectedPortfolioId}` : '';

    const [summaryRes, historyRes, assetsRes, liabilitiesRes, portfoliosRes, accountsRes, catalogRes] =
      await Promise.all([
        fetch('/api/networth/summary'),
        fetch(`/api/networth/history${query}`),
        fetch(`/api/assets${query}`),
        fetch(`/api/liabilities${query}`),
        fetch('/api/portfolios'),
        fetch(`/api/accounts${query}`),
        fetch('/api/catalog')
      ]);

    const [summaryJson, historyJson, assetsJson, liabilitiesJson, portfoliosJson, accountsJson, catalogJson] =
      await Promise.all([
        summaryRes.json(),
        historyRes.json(),
        assetsRes.json(),
        liabilitiesRes.json(),
        portfoliosRes.json(),
        accountsRes.json(),
        catalogRes.json()
      ]);

    setSummary(summaryJson.data ?? null);
    setHistory(historyJson.data ?? []);
    setAssets(assetsJson.data ?? []);
    setLiabilities(liabilitiesJson.data ?? []);
    setPortfolios(portfoliosJson.data ?? []);
    setAccounts(accountsJson.data ?? []);
    setCatalog(catalogJson.data ?? { assetCategories: [], liabilityCategories: [], currencies: [] });
    setLoading(false);
  }, [selectedPortfolioId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assetDistribution = useMemo(() => {
    const grouped = new Map<string, number>();
    assets.forEach((asset) => grouped.set(asset.categoryId, (grouped.get(asset.categoryId) ?? 0) + asset.value));

    return Array.from(grouped.entries()).map(([categoryId, value]) => ({
      name: catalog.assetCategories.find((x) => x.id === categoryId)?.name ?? categoryId,
      value
    }));
  }, [assets, catalog.assetCategories]);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Understand and grow your net worth.</p>
        </div>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={selectedPortfolioId}
          onChange={(e) => setSelectedPortfolioId(e.target.value)}
        >
          <option value="all">Todos los portfolios</option>
          {portfolios.map((portfolio) => (
            <option key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
            </option>
          ))}
        </select>
      </header>

      {loading ? <Card>Cargando dashboard...</Card> : null}
      {!loading && assets.length === 0 && liabilities.length === 0 ? (
        <Card>Tu dashboard está vacío. Comienza agregando tu primer activo en onboarding.</Card>
      ) : null}

      <KpiCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <NetWorthTrendChart data={history} />
        <CategoryAllocationChart title="Asset allocation by category" data={assetDistribution} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PortfolioNetWorthChart data={summary?.byPortfolio ?? []} />
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Pasivos recientes</h3>
          {liabilities.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no tienes pasivos registrados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {liabilities.slice(0, 6).map((liability) => (
                <li key={liability.id} className="flex justify-between">
                  <span>{liability.name}</span>
                  <span className="font-semibold">{formatCurrency(liability.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>


      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold">Integraciones de brokers</h3>
          <div className="space-y-3">
            <BrokerConnectForm broker="binance" onSynced={loadData} />
            <BrokerConnectForm broker="iol" onSynced={loadData} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Activos recientes</h3>
          {assets.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no tienes activos registrados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assets.slice(0, 8).map((asset) => (
                <li key={asset.id} className="flex justify-between">
                  <span>{asset.name}</span>
                  <span className="font-semibold">{formatCurrency(asset.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>


      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Agregar Activo</h3>
          <AssetForm
            onCreated={loadData}
            portfolios={portfolios.map((x) => ({ value: x.id, label: x.name }))}
            accounts={accounts.map((x) => ({ value: x.id, label: x.name, portfolioId: x.portfolioId }))}
            categories={catalog.assetCategories.map((x) => ({ value: x.id, label: x.name }))}
            currencies={catalog.currencies.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))}
          />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Agregar Pasivo</h3>
          <LiabilityForm
            onCreated={loadData}
            portfolios={portfolios.map((x) => ({ value: x.id, label: x.name }))}
            categories={catalog.liabilityCategories.map((x) => ({ value: x.id, label: x.name }))}
            currencies={catalog.currencies.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))}
          />
        </Card>
      </div>
    </section>
  );
}
