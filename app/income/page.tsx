'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

type Income = {
  id: string;
  date: string;
  source: string;
  category: string;
  amount: number;
  currency: string;
};

const CATEGORIES = ['Work', 'Investments', 'Freelance', 'Business', 'Other'];

export default function IncomePage() {
  const [items, setItems] = useState<Income[]>([]);
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/income', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray((data as any).items) ? (data as any).items : []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ source, category, amount: Number(amount), currency, date }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError((data as any).message || 'Error al guardar.');
      return;
    }

    setSource('');
    setAmount('');
    setCategory('Other');
    await load();
  }

  const rows = items.map((item) => ({
    ...item,
    date: item.date?.slice(0, 10) ?? '—',
    amount: `${item.currency} ${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader title="Income" subtitle="Registrá y analizá tus ingresos." />

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-6" onSubmit={onSubmit}>
        <Input placeholder="Fuente" value={source} onChange={(e) => setSource(e.target.value)} required />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input type="number" placeholder="Monto" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Button disabled={loading}>{loading ? 'Guardando...' : 'Agregar ingreso'}</Button>
        {error ? <p className="text-sm text-red-500 md:col-span-6">{error}</p> : null}
      </form>

      <DataTable
        title="Ingresos registrados"
        columns={[
          { key: 'date', label: 'Fecha', sortable: true },
          { key: 'source', label: 'Fuente', sortable: true },
          { key: 'category', label: 'Categoría', sortable: true, render: (row) => <Badge variant="success">{row.category}</Badge> },
          { key: 'amount', label: 'Monto', sortable: true },
        ]}
        rows={rows}
      />
    </div>
  );
}
