'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { useDashboard } from '@/src/hooks/useDashboard';
import { KPIcard } from '@/components/dashboard/KPIcard';
import { IncomeExpensesChart } from '@/components/dashboard/charts/IncomeExpensesChart';
import { AllocationPie } from '@/components/dashboard/charts/AllocationPie';
import { CashflowChart } from '@/components/dashboard/charts/CashflowChart';
import { MoversTable } from '@/components/dashboard/tables/MoversTable';

export default function DashboardPage() {
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'ARS'>('USD');
  const dashboard = useDashboard();

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
      </div>
    </div>
  );
}
