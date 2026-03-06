'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BrokerConnectForm({ broker, onSynced }: { broker: 'binance' | 'iol'; onSynced: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [message, setMessage] = useState<string>('');

  async function connect() {
    const response = await fetch(`/api/integrations/${broker}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, apiSecret })
    });

    if (!response.ok) {
      setMessage(`No se pudo conectar ${broker.toUpperCase()}`);
      return;
    }

    setMessage(`${broker.toUpperCase()} conectado`);
  }

  async function sync() {
    const response = await fetch(`/api/integrations/${broker}/sync`, { method: 'POST' });
    if (!response.ok) {
      setMessage(`No se pudo sincronizar ${broker.toUpperCase()}`);
      return;
    }
    setMessage(`${broker.toUpperCase()} sincronizado`);
    onSynced();
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-semibold">{broker.toUpperCase()}</p>
      <Input placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <Input placeholder="API Secret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={connect}>Conectar</Button>
        <Button className="bg-slate-700" onClick={sync}>
          Sync manual
        </Button>
      </div>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
