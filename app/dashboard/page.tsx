'use client';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { useDashboard } from '@/src/hooks/useDashboard';

export default function DashboardPage() {
  const dashboard = useDashboard();

  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard" subtitle="Resumen financiero unificado" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Net Worth USD</p>
          <p className="text-2xl font-semibold">{formatCurrency(dashboard.netWorth.usd, 'USD')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Net Worth ARS</p>
          <p className="text-2xl font-semibold">{formatCurrency(dashboard.netWorth.ars, 'ARS')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-2xl font-semibold">{formatCurrency(dashboard.cashflow.totalIncome, 'USD')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-semibold">{formatCurrency(dashboard.cashflow.totalExpenses, 'USD')}</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Savings Rate</p>
        <p className="text-xl font-semibold">{formatPercent(dashboard.cashflow.savingsRate * 100)}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Top Gainers</p>
          <ul className="space-y-1 text-sm">
            {dashboard.movers.gainers.length === 0 ? <li>—</li> : dashboard.movers.gainers.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>{item.symbol}</span>
                <span>{item.profitLossUsd === null ? '—' : formatCurrency(item.profitLossUsd, 'USD')}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Top Losers</p>
          <ul className="space-y-1 text-sm">
            {dashboard.movers.losers.length === 0 ? <li>—</li> : dashboard.movers.losers.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>{item.symbol}</span>
                <span>{item.profitLossUsd === null ? '—' : formatCurrency(item.profitLossUsd, 'USD')}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
