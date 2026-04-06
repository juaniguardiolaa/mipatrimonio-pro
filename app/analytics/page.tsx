'use client';
 
import { useMemo, useState } from 'react';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { KpiCard } from '@/components/ui/KpiCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Tabs } from '@/components/ui/Tabs';
import { BarChart3, CalendarClock, CircleDollarSign, PieChart } from 'lucide-react';
import { IncomeVsExpensesChart } from '@/components/charts/IncomeVsExpensesChart';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';
import { useDashboard } from '@/src/hooks/useDashboard';
import { useFinancialInsights } from '@/src/hooks/useFinancialInsights';
import { useSimulation } from '@/src/hooks/useSimulation';
 
// ── FIX: replaced every hardcoded KPI and chart dataset with real computed
// values from the shared hooks. Previously this page showed static numbers
// (savings rate 31.4%, net cashflow 14,220, etc.) that contradicted the
// dashboard and gave users a false picture of their finances.
 
const RANGE_MONTHS: Record<string, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
};
 
const EXPENSE_COLORS: Record<string, string> = {
  Housing: '#2563EB',
  Food: '#10B981',
  Transport: '#F59E0B',
  Leisure: '#8B5CF6',
  Health: '#EF4444',
  Education: '#14B8A6',
  Other: '#6B7280',
};
 
export default function AnalyticsPage() {
  const [range, setRange] = useState('6M');
  const dashboard = useDashboard();
  const insights = useFinancialInsights();
  const simulation = useSimulation();
 
  // Slice monthly data to selected range
  const months = RANGE_MONTHS[range] ?? 6;
  const slicedMonthly = useMemo(
    () => dashboard.cashflow.monthly.slice(-months),
    [dashboard.cashflow.monthly, months],
  );
 
  // Income vs expenses chart data
  const incomeExpensesData = useMemo(
    () =>
      slicedMonthly.map((row) => ({
        month: row.month,
        income: row.income,
        expenses: row.expenses,
      })),
    [slicedMonthly],
  );
 
  // Expense breakdown by asset type (using allocation as a proxy for expense
  // categories; a real breakdown would come from /api/expenses with category grouping)
  const allocationData = useMemo(
    () =>
      dashboard.allocation.byType.map((row, i) => ({
        name: row.assetType,
        value: Math.round(row.percentage * 10) / 10,
        color: Object.values(EXPENSE_COLORS)[i % Object.values(EXPENSE_COLORS).length],
      })),
    [dashboard.allocation.byType],
  );
 
  // Net cashflow over the selected range
  const netCashflow = useMemo(
    () => slicedMonthly.reduce((s, r) => s + r.net, 0),
    [slicedMonthly],
  );
 
  // Projected net worth from simulation (1-year horizon from the optimized scenario)
  const forecast = simulation.optimizedScenario.simulation[11]?.netWorthUsd ?? null;
 
  if (dashboard.loading) {
    return <div className="p-6 text-sm text-gray-400">Cargando analytics…</div>;
  }
 
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analytics"
        subtitle="Insights financieros, patrones y distribución."
        actions={
          <Tabs
            tabs={['1M', '3M', '6M', '1Y']}
            active={range}
            onChange={setRange}
          />
        }
      />
 
      <div className="grid gap-4 md:grid-cols-4">
        {/* Savings rate — from real cashflow data */}
        <KpiCard
          title="Savings Rate"
          value={Math.round(dashboard.cashflow.savingsRate * 1000) / 10}
          trend={0}
          icon={BarChart3}
          currency="%"
        />
        {/* Net cashflow for the selected range */}
        <KpiCard
          title={`Net Cashflow (${range})`}
          value={Math.round(netCashflow)}
          trend={0}
          icon={CircleDollarSign}
          currency="USD"
        />
        {/* Top asset-type concentration as volatility proxy */}
        <KpiCard
          title="Top Concentration"
          value={
            Math.round(
              (dashboard.allocation.byType[0]?.percentage ?? 0) * 10,
            ) / 10
          }
          trend={0}
          icon={PieChart}
          currency="%"
        />
        {/* 12-month projected net worth from simulation */}
        <KpiCard
          title="12-Month Forecast"
          value={forecast !== null ? Math.round(forecast) : 0}
          trend={0}
          icon={CalendarClock}
          currency="USD"
        />
      </div>
 
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartContainer title={`Income vs Expenses (${range})`}>
          {incomeExpensesData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay datos de cashflow para el período seleccionado.
            </p>
          ) : (
            <IncomeVsExpensesChart data={incomeExpensesData} />
          )}
        </ChartContainer>
 
        <ChartContainer title="Distribución por tipo de activo">
          {allocationData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay posiciones con precio de mercado disponible.
            </p>
          ) : (
            <AssetAllocationChart data={allocationData} />
          )}
        </ChartContainer>
      </div>
 
      {/* Health score and top alerts as summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Health Score</p>
          <p className="text-4xl font-semibold">{insights.healthScore}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {insights.healthScore >= 80
              ? 'Excellent'
              : insights.healthScore >= 60
                ? 'Good'
                : insights.healthScore >= 40
                  ? 'Average'
                  : 'Poor'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Top alerts</p>
          {insights.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active alerts.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {insights.alerts.slice(0, 3).map((alert) => (
                <li
                  key={alert.id}
                  className={`rounded-lg border p-2 ${
                    alert.severity === 'high'
                      ? 'border-rose-500/60 bg-rose-950/30 text-rose-100'
                      : alert.severity === 'medium'
                        ? 'border-amber-500/50 bg-amber-950/20'
                        : 'border-sky-500/40 bg-sky-950/20'
                  }`}
                >
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
 
