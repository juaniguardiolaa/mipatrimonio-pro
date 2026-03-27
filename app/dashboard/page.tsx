'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { useSimulation } from '@/src/hooks/useSimulation';
import { useProactiveAdvisor } from '@/src/hooks/useProactiveAdvisor';
import { useAdvisorMemory } from '@/src/hooks/useAdvisorMemory';
import { KPIcard } from '@/components/dashboard/KPIcard';
import { IncomeExpensesChart } from '@/components/dashboard/charts/IncomeExpensesChart';
import { AllocationPie } from '@/components/dashboard/charts/AllocationPie';
import { CashflowChart } from '@/components/dashboard/charts/CashflowChart';
import { MoversTable } from '@/components/dashboard/tables/MoversTable';
import { Card } from '@/components/ui/Card';
import { SimulationChart } from '@/components/dashboard/charts/SimulationChart';

function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex cursor-help items-center text-slate-400" aria-label={text}>
      ℹ️
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 p-2 text-[11px] normal-case text-slate-200 shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export default function DashboardPage() {
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'ARS'>('USD');
  const [monthlySavingsInput, setMonthlySavingsInput] = useState<string>('');
  const [expenseReductionInput, setExpenseReductionInput] = useState<string>('0');
  const [goalInput, setGoalInput] = useState<string>('');

  const simulationLayer = useSimulation({
    monthlySavings: monthlySavingsInput === '' ? undefined : Number(monthlySavingsInput),
    expenseReductionPercent: Number(expenseReductionInput || 0),
    targetAmountUsd: goalInput === '' ? undefined : Number(goalInput),
  });
  const insightsLayer = simulationLayer.insights;
  const dashboard = simulationLayer.dashboard;
  const proactiveAdvisor = useProactiveAdvisor();
  const advisorMemory = useAdvisorMemory();

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
          title={(
            <span>
              Savings Rate
              <InfoHint text="Percentage of income that remains after expenses." />
            </span>
          )}
          value={formatPercent(dashboard.cashflow.savingsRate * 100)}
          subvalue={`Income ${formatCurrency(dashboard.cashflow.totalIncome, 'USD')} · Expenses ${formatCurrency(dashboard.cashflow.totalExpenses, 'USD')}`}
        />
        <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Health Score
            <InfoHint text="Calculated using savings rate, expense ratio, diversification, and cash position, with hard caps for critical risk conditions." />
          </p>
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
          <p className="text-sm font-semibold text-white">
            Insights
            <InfoHint text="Insights are ranked from snapshot history and current portfolio/cashflow risk signals." />
          </p>
          <div className="mt-3 space-y-3 text-sm text-gray-300">
            {(['cashflow', 'investments', 'risk', 'general'] as const).map((category) => {
              const rows = insightsLayer.insights.filter((insight) => insight.category === category);
              if (rows.length === 0) return null;
              return (
                <div key={category}>
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{category}</p>
                  <ul className="space-y-2">
                    {rows.map((insight) => (
                      <li key={insight.id} className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                        <p className="font-medium text-white">{insight.title}</p>
                        <p className="mt-1 text-gray-400">{insight.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
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
          <p className="text-sm font-semibold text-white">
            Recommendations
            <InfoHint text="Recommendations are prioritized by estimated impact using your real metrics and simulated improvements." />
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            {insightsLayer.recommendations.map((recommendation) => (
              <li key={recommendation.id} className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3">
                <p className="font-medium text-emerald-200">{recommendation.action}</p>
                <p className="mt-1 text-gray-300">{recommendation.reason}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-3 rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-white">
            Simulation Panel
            <InfoHint text="Projection applies weighted expected return, inflation-adjusted growth, and your what-if inputs." />
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-300">
              Monthly savings (USD)
              <input
                type="number"
                min="0"
                value={monthlySavingsInput}
                onChange={(e) => setMonthlySavingsInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                placeholder="Auto from cashflow"
              />
            </label>
            <label className="text-xs text-slate-300">
              Expense reduction %
              <input
                type="number"
                min="0"
                max="100"
                value={expenseReductionInput}
                onChange={(e) => setExpenseReductionInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-300">
              Target goal (USD)
              <input
                type="number"
                min="0"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-200">
              <p>Expected annual return: {formatPercent(simulationLayer.expectedReturn * 100)}</p>
              <p>Real annual return: {formatPercent(simulationLayer.realReturn * 100)}</p>
              <p>Projected net worth: {formatCurrency(simulationLayer.projectedNetWorth.usd, 'USD')}</p>
              {simulationLayer.conservativeYearsToGoal !== null || simulationLayer.optimisticYearsToGoal !== null ? (
                <p>
                  Estimated range:{' '}
                  {simulationLayer.optimisticYearsToGoal !== null ? simulationLayer.optimisticYearsToGoal : 'N/A'}
                  {' – '}
                  {simulationLayer.conservativeYearsToGoal !== null ? simulationLayer.conservativeYearsToGoal : 'N/A'} years
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-400">Optimistic assumes stronger market performance with the same strategy.</p>
              <p className="text-xs text-slate-400">Conservative assumes lower returns and tougher market conditions.</p>
            </div>
            <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm text-emerald-100">
              <p>
                {simulationLayer.optimizedScenario.monthsToGoal
                  ? `With this strategy: goal in ${simulationLayer.optimizedScenario.yearsToGoal} years`
                  : 'With this strategy: goal not reached in selected horizon'}
              </p>
              <p>
                {simulationLayer.baseScenario.monthsToGoal
                  ? `Base scenario reaches goal in ${simulationLayer.baseScenario.yearsToGoal} years`
                  : 'Base scenario does not reach goal in selected horizon'}
              </p>
              {goalInput !== '' ? (
                <>
                  <p>You have reached {(simulationLayer.goalProgress * 100).toFixed(1)}% of your goal.</p>
                  <p>Remaining: {formatCurrency(simulationLayer.remainingAmount, 'USD')}</p>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <SimulationChart
              data={simulationLayer.optimizedScenario.simulation.map((row, index) => ({
                month: row.month,
                baseUsd: simulationLayer.baseScenario.simulation[index]?.netWorthUsd ?? row.netWorthUsd,
                optimizedUsd: row.netWorthUsd,
              }))}
            />
          </div>
        </Card>

        <Card className="xl:col-span-3 rounded-xl border border-indigo-600/40 bg-indigo-950/20 p-4 shadow-sm">
          <p className="text-sm font-semibold text-white">AI Advisor</p>
          <div className="mt-2 rounded-lg border border-rose-500/50 bg-rose-950/30 p-3">
            <p className="text-xs uppercase tracking-wide text-rose-200">🔥 What matters most now</p>
            <p className="mt-1 text-sm text-rose-100">
              {proactiveAdvisor.topPriority
                ? `${proactiveAdvisor.topPriority.message} (${Math.round(proactiveAdvisor.topPriority.severity * 100)}% severity)`
                : 'No critical priority detected right now.'}
            </p>
          </div>
          <p className="mt-1 text-sm text-indigo-100">🧠 AI says: {proactiveAdvisor.aiSummary}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-indigo-500/30 bg-slate-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-indigo-200">🔔 Active alerts</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {proactiveAdvisor.smartAlerts.slice(0, 3).map((alert) => (
                  <li key={alert.key}>{alert.message}</li>
                ))}
                {proactiveAdvisor.smartAlerts.length === 0 ? <li className="text-slate-400">No active alerts.</li> : null}
              </ul>
            </div>
            <div className="rounded-lg border border-indigo-500/30 bg-slate-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-indigo-200">💡 Suggestions</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {insightsLayer.recommendations.slice(0, 3).map((recommendation) => (
                  <li key={recommendation.id}>{recommendation.action}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-indigo-500/30 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-wide text-indigo-200">📌 Pending recommendations</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              {advisorMemory.pendingRecommendations.slice(0, 3).map((recommendation) => (
                <li key={recommendation.text} className="flex items-center justify-between gap-2">
                  <span>{recommendation.text}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-emerald-500/60 px-2 py-1 text-xs text-emerald-300"
                      onClick={() => advisorMemory.setRecommendationStatus(recommendation.text, 'completed')}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className="rounded border border-amber-500/60 px-2 py-1 text-xs text-amber-300"
                      onClick={() => advisorMemory.setRecommendationStatus(recommendation.text, 'ignored')}
                    >
                      Ignore
                    </button>
                  </div>
                </li>
              ))}
              {advisorMemory.pendingRecommendations.length === 0 ? <li className="text-slate-400">No pending recommendations.</li> : null}
            </ul>
          </div>
          <div className="mt-3 rounded-lg border border-indigo-500/30 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-wide text-indigo-200">Timeline feed</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {proactiveAdvisor.events.slice(0, 5).map((event, index) => (
                <li key={`${event.type}-${index}`}>{new Date(event.timestamp).toLocaleDateString()} · {event.message}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
