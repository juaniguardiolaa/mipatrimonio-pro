'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Option {
  value: string;
  label: string;
}

export function LiabilityForm({
  onCreated,
  portfolios,
  categories,
  currencies
}: {
  onCreated: () => void;
  portfolios: Option[];
  categories: Option[];
  currencies: Option[];
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.value ?? '');
  const [categoryId, setCategoryId] = useState(categories[0]?.value ?? '');
  const [currency, setCurrency] = useState(currencies[0]?.value ?? 'USD');
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/liabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, amount: Number(amount), portfolioId, categoryId, currency })
    });

    if (!response.ok) {
      setStatus('No se pudo guardar el pasivo');
      return;
    }

    setStatus('Pasivo creado con éxito');
    setName('');
    setAmount('');
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input placeholder="Nombre del pasivo" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input placeholder="Monto" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />

      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
        {portfolios.map((item) => (
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

      <Button type="submit">Agregar pasivo</Button>
      {status ? <p className="text-xs text-slate-500">{status}</p> : null}
    </form>
  );
}
