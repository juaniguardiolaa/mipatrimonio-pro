'use client';

import { useEffect, useState } from 'react';
import { AssetForm } from '@/components/forms/asset-form';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import type { Asset } from '@/types';

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; portfolioId: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);

  async function load() {
    const [assetsRes, portfoliosRes, accountsRes, catalogRes] = await Promise.all([
      fetch('/api/assets'),
      fetch('/api/portfolios'),
      fetch('/api/accounts'),
      fetch('/api/catalog')
    ]);

    const assetsJson = await assetsRes.json();
    const portfoliosJson = await portfoliosRes.json();
    const accountsJson = await accountsRes.json();
    const catalogJson = await catalogRes.json();

    setAssets(assetsJson.data ?? []);
    setPortfolios(portfoliosJson.data ?? []);
    setAccounts(accountsJson.data ?? []);
    setCategories(catalogJson.data.assetCategories ?? []);
    setCurrencies(catalogJson.data.currencies ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeAsset(id: string) {
    if (!window.confirm('¿Eliminar este activo?')) return;
    await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Assets</h1>
      <Card>
        <AssetForm
          onCreated={load}
          portfolios={portfolios.map((x) => ({ value: x.id, label: x.name }))}
          accounts={accounts.map((x) => ({ value: x.id, label: x.name, portfolioId: x.portfolioId }))}
          categories={categories.map((x) => ({ value: x.id, label: x.name }))}
          currencies={currencies.map((x) => ({ value: x.code, label: x.code }))}
        />
      </Card>
      <Card>
        {assets.length === 0 ? <p className="text-sm text-slate-500">No hay activos cargados todavía.</p> : null}
        <ul className="space-y-2 text-sm">
          {assets.map((asset) => (
            <li key={asset.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span>{asset.name}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatCurrency(asset.value)}</span>
                <button className="text-xs text-red-600" onClick={() => removeAsset(asset.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
