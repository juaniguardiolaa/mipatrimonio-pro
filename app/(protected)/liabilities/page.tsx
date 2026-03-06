'use client';

import { useEffect, useState } from 'react';
import { LiabilityForm } from '@/components/forms/liability-form';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import type { Liability } from '@/types';

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);

  async function load() {
    const [liabilitiesRes, portfoliosRes, catalogRes] = await Promise.all([
      fetch('/api/liabilities'),
      fetch('/api/portfolios'),
      fetch('/api/catalog')
    ]);

    const liabilitiesJson = await liabilitiesRes.json();
    const portfoliosJson = await portfoliosRes.json();
    const catalogJson = await catalogRes.json();

    setLiabilities(liabilitiesJson.data ?? []);
    setPortfolios(portfoliosJson.data ?? []);
    setCategories(catalogJson.data.liabilityCategories ?? []);
    setCurrencies(catalogJson.data.currencies ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeLiability(id: string) {
    if (!window.confirm('¿Eliminar este pasivo?')) return;
    await fetch(`/api/liabilities/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Liabilities</h1>
      <Card>
        <LiabilityForm
          onCreated={load}
          portfolios={portfolios.map((x) => ({ value: x.id, label: x.name }))}
          categories={categories.map((x) => ({ value: x.id, label: x.name }))}
          currencies={currencies.map((x) => ({ value: x.code, label: x.code }))}
        />
      </Card>
      <Card>
        {liabilities.length === 0 ? <p className="text-sm text-slate-500">No hay pasivos cargados todavía.</p> : null}
        <ul className="space-y-2 text-sm">
          {liabilities.map((liability) => (
            <li key={liability.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span>{liability.name}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatCurrency(liability.amount)}</span>
                <button className="text-xs text-red-600" onClick={() => removeLiability(liability.id)}>
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
