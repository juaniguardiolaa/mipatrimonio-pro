'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

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
  const [accountType, setAccountType] = useState('BROKER');
  const [currency, setCurrency] = useState('ARS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadAccounts() {
    const res = await fetch('/api/accounts', { cache: 'no-store', credentials: 'include' });
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
      credentials: 'include',
      body: JSON.stringify({ name, institution, type: accountType, currency }),
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

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-5" onSubmit={onSubmit}>
        <Input placeholder="Nombre de cuenta" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="Institución (ej: IOL)" value={institution} onChange={(e) => setInstitution(e.target.value)} required />
        <Select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
          <option value="BROKER">Broker</option>
          <option value="SAVINGS">Caja de ahorro</option>
          <option value="CHECKING">Cuenta corriente</option>
          <option value="CRYPTO_EXCHANGE">Exchange crypto</option>
        </Select>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </Select>
        <Button disabled={loading}>{loading ? 'Guardando...' : 'Agregar cuenta'}</Button>
        {error ? <p className="text-sm text-red-500 md:col-span-5">{error}</p> : null}
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
