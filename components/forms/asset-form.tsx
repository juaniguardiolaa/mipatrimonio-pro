'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Option {
  value: string;
  label: string;
}

export function AssetForm({
  onCreated,
  portfolios,
  accounts,
  categories,
  currencies
}: {
  onCreated: () => void;
  portfolios: Option[];
  accounts: (Option & { portfolioId: string })[];
  categories: Option[];
  currencies: Option[];
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.value ?? '');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.value ?? '');
  const [currency, setCurrency] = useState(currencies[0]?.value ?? 'USD');
  const [status, setStatus] = useState<string | null>(null);

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => account.portfolioId === portfolioId),
    [accounts, portfolioId]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const selectedAccount = accountId || filteredAccounts[0]?.value;

    const response = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        value: Number(value),
        portfolioId,
        accountId: selectedAccount,
        categoryId,
        currency
      })
    });

    if (!response.ok) {
      setStatus('No se pudo guardar el activo');
      return;
    }

    setStatus('Activo creado con éxito');
    setName('');
    setValue('');
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input placeholder="Nombre del activo" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input placeholder="Valor" type="number" value={value} onChange={(e) => setValue(e.target.value)} required />

      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
        {portfolios.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {filteredAccounts.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        {categories.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {currencies.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <Button type="submit">Agregar activo</Button>
      {status ? <p className="text-xs text-slate-500">{status}</p> : null}
    </form>
  );
}
