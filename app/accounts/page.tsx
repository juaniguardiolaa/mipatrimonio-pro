'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type HoldingAccount = {
  id: string;
  name: string;
  institution: string;
  type: string;
  currency: string;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<HoldingAccount[]>([]);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadAccounts() {
    const res = await fetch('/api/accounts', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setAccounts(data.accounts || []);
  }

  useEffect(() => {
    loadAccounts().catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, institution, type: 'BROKER', currency: 'ARS' }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.message || 'No se pudo crear la cuenta.');
      return;
    }

    setName('');
    setInstitution('');
    await loadAccounts();
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Accounts" subtitle="Conectá tus brokers y cuentas para habilitar tu onboarding financiero." />

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4" onSubmit={onSubmit}>
        <Input placeholder="Nombre de cuenta" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="Institución (ej: IOL)" value={institution} onChange={(e) => setInstitution(e.target.value)} required />
        <Badge variant="neutral" className="h-10 items-center justify-center">Tipo: Broker</Badge>
        <Button disabled={loading}>{loading ? 'Guardando...' : 'Agregar cuenta'}</Button>
        {error ? <p className="md:col-span-4 text-sm text-red-500">{error}</p> : null}
      </form>

      <DataTable
        title="Cuentas creadas"
        columns={[
          { key: 'name', label: 'Cuenta', sortable: true },
          { key: 'institution', label: 'Institución', sortable: true },
          { key: 'type', label: 'Tipo', sortable: true },
          { key: 'currency', label: 'Moneda', sortable: true },
        ]}
        rows={accounts}
      />
    </div>
  );
}
