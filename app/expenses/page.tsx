'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

type Expense = {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
};

const CATEGORIES = ['Housing', 'Food', 'Transport', 'Health', 'Education', 'Leisure', 'Other'];

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/expenses', { cache: 'no-store', credentials: 'include' });
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

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, category, amount: Number(amount), currency, date }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError((data as any).message || 'Error al guardar.');
      return;
    }

    setName('');
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
      <SectionHeader title="Expenses" subtitle="Registrá y controlá tus gastos." />

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-6" onSubmit={onSubmit}>
        <Input placeholder="Concepto" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input type="number" placeholder="Monto" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Button disabled={loading}>{loading ? 'Guardando...' : 'Agregar gasto'}</Button>
        {error ? <p className="text-sm text-red-500 md:col-span-6">{error}</p> : null}
      </form>

      <DataTable
        title="Gastos registrados"
        columns={[
          { key: 'date', label: 'Fecha', sortable: true },
          { key: 'name', label: 'Concepto', sortable: true },
          { key: 'category', label: 'Categoría', sortable: true, render: (row) => <Badge variant="danger">{row.category}</Badge> },
          { key: 'amount', label: 'Monto', sortable: true },
        ]}
        rows={rows}
      />
    </div>
  );
}
