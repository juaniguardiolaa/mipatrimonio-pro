'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [portfolioName, setPortfolioName] = useState('Personal');
  const [accountName, setAccountName] = useState('Main Account');
  const [portfolioId, setPortfolioId] = useState('');
  const [accountId, setAccountId] = useState('');

  async function createPortfolio() {
    const res = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: portfolioName })
    });
    const json = await res.json();
    if (res.ok) {
      setPortfolioId(json.data.id);
      setStep(2);
    }
  }

  async function createAccount() {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId, name: accountName, type: 'bank', currency: 'USD' })
    });
    const json = await res.json();
    if (res.ok) {
      setAccountId(json.data.id);
      setStep(3);
    }
  }

  async function createFirstAsset() {
    const catalog = await fetch('/api/catalog').then((r) => r.json());
    const firstCategory = catalog.data.assetCategories[0]?.id;
    await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId,
        accountId,
        categoryId: firstCategory,
        currency: 'USD',
        name: 'First Asset',
        value: 1000
      })
    });

    router.push('/dashboard');
  }

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Onboarding</h1>

      {step === 1 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Step 1: Create your first portfolio</h2>
          <Input value={portfolioName} onChange={(e) => setPortfolioName(e.target.value)} />
          <Button className="mt-3" onClick={createPortfolio}>
            Continue
          </Button>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Step 2: Create your first account</h2>
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <Button className="mt-3" onClick={createAccount}>
            Continue
          </Button>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Step 3: Add your first asset</h2>
          <Button onClick={createFirstAsset}>Finish onboarding</Button>
        </Card>
      ) : null}
    </section>
  );
}
