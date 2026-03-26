'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { useFinancialInsights } from '@/src/hooks/useFinancialInsights';
import { KPIcard } from '@/components/dashboard/KPIcard';
import { IncomeExpensesChart } from '@/components/dashboard/charts/IncomeExpensesChart';
import { AllocationPie } from '@/components/dashboard/charts/AllocationPie';
import { CashflowChart } from '@/components/dashboard/charts/CashflowChart';
import { MoversTable } from '@/components/dashboard/tables/MoversTable';
import { Card } from '@/components/ui/Card';

export default function DashboardPage() {
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'ARS'>('USD');
  const insightsLayer = useFinancialInsights();
  const dashboard = insightsLayer.dashboard;

  const incomeExpensesData = useMemo(() => dashboard.cashflow.monthly.map((row) => ({
    month: row.month,
    income: row.income,
    expenses: row.expenses,
  })), [dashboard.cashflow.monthly]);

  const cashflowNetData = useMemo(() => dashboard.cashflow.monthly.map((row) => ({
    month: row.month,
    net: row.net,
  })), [dashboard.cashflow.monthly]);

  const allocationByAssetData = useMemo(() => {
    const sorted = [...dashboard.allocation.byAsset].sort((a, b) => b.valueUsd - a.valueUsd);
    const top = sorted.slice(0, 5).map((row) => ({ name: row.symbol, value: row.valueUsd }));
    const othersValue = sorted.slice(5).reduce((sum, row) => sum + row.valueUsd, 0);
    if (othersValue > 0) top.push({ name: 'Others', value: othersValue });
    return top;
  }, [dashboard.allocation.byAsset]);

  const allocationByTypeData = useMemo(
    () => dashboard.allocation.byType.map((row) => ({ name: row.assetType, value: row.valueUsd })),
    [dashboard.allocation.byType],
  );

  const netWorthValue = baseCurrency === 'USD'
    ? formatCurrency(dashboard.netWorth.usd, 'USD')
    : formatCurrency(dashboard.netWorth.ars, 'ARS');

  const cashValue = baseCurrency === 'USD'
    ? formatCurrency(dashboard.cash.usd, 'USD')
    : formatCurrency(dashboard.cash.ars, 'ARS');

  console.log('[dashboard] render', {
    baseCurrency,
    loading: dashboard.loading,
    positions: dashboard.portfolio.positions.length,
  });

  if (dashboard.loading) {
    return <div className="p-6 text-sm text-gray-400">Loading dashboard…</div>;
  }

  const healthLabel = insightsLayer.healthScore >= 80
    ? { text: 'Excellent', className: 'text-emerald-400' }
    : insightsLayer.healthScore >= 60
      ? { text: 'Good', className: 'text-lime-300' }
      : insightsLayer.healthScore >= 40
        ? { text: 'Average', className: 'text-amber-300' }
        : { text: 'Poor', className: 'text-rose-400' };

  return (
    <div className="min-h-screen space-y-6 bg-[#0B1220] p-4 text-white md:p-6">
      <SectionHeader
        title="Portfolio PRO Dashboard"
        subtitle="Control financiero consolidado"
        actions={(
          <div className="w-32">
            <Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value as 'USD' | 'ARS')}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </Select>
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-3 xl:auto-rows-auto">
        <KPIcard
          title="Net Worth"
          value={netWorthValue}
          subvalue={`USD ${formatCurrency(dashboard.netWorth.usd, 'USD')} · ARS ${formatCurrency(dashboard.netWorth.ars, 'ARS')}`}
        />
        <KPIcard
          title="Cash"
          value={cashValue}
          subvalue={`USD ${formatCurrency(dashboard.cash.usd, 'USD')} · ARS ${formatCurrency(dashboard.cash.ars, 'ARS')}`}
        />
        <KPIcard
          title="Savings Rate"
          value={formatPercent(dashboard.cashflow.savingsRate * 100)}
          subvalue={`Income ${formatCurrency(dashboard.cashflow.totalIncome, 'USD')} · Expenses ${formatCurrency(dashboard.cashflow.totalExpenses, 'USD')}`}
        />
        <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-400">Health Score</p>
          <p className="mt-2 text-4xl font-semibold text-white">{insightsLayer.healthScore}</p>
          <p className={`mt-1 text-sm font-medium ${healthLabel.className}`}>{healthLabel.text}</p>
        </Card>

        <div className="xl:col-span-2">
          <IncomeExpensesChart data={incomeExpensesData} />
        </div>
        <AllocationPie title="Allocation by Asset" data={allocationByAssetData} />

        <MoversTable title="Top Gainers" type="gainer" rows={dashboard.movers.gainers} />
        <MoversTable title="Top Losers" type="loser" rows={dashboard.movers.losers} />
        <AllocationPie title="Allocation by Type" data={allocationByTypeData} />

        <div className="xl:col-span-3">
          <CashflowChart data={cashflowNetData} />
        </div>

        <Card className="xl:col-span-2 rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-white">Insights</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            {insightsLayer.insights.map((insight) => (
              <li key={insight.id} className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                <p className="font-medium text-white">{insight.title}</p>
                <p className="mt-1 text-gray-400">{insight.description}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-white">Alerts</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            {insightsLayer.alerts.length === 0 ? <li className="text-gray-400">No alerts detected.</li> : null}
            {insightsLayer.alerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded-lg border p-3 ${alert.severity === 'high' ? 'border-rose-500/60 bg-rose-950/40 text-rose-100' : alert.severity === 'medium' ? 'border-amber-500/50 bg-amber-950/20' : 'border-sky-500/40 bg-sky-950/20'}`}
              >
                <p className="font-medium capitalize">{alert.severity} alert</p>
                <p className="mt-1">{alert.message}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-3 rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-white">Recommendations</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            {insightsLayer.recommendations.map((recommendation) => (
              <li key={recommendation.id} className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3">
                <p className="font-medium text-emerald-200">{recommendation.action}</p>
                <p className="mt-1 text-gray-300">{recommendation.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
