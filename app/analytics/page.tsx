'use client';

import { ChartContainer } from '@/components/ui/ChartContainer';
import { KpiCard } from '@/components/ui/KpiCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Tabs } from '@/components/ui/tabs';
import { BarChart3, CalendarClock, CircleDollarSign, PieChart } from 'lucide-react';
import { useState } from 'react';
import { IncomeVsExpensesChart } from '@/components/charts/IncomeVsExpensesChart';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';

export default function AnalyticsPage() {
  const [range, setRange] = useState('6M');
  return (
    <div className="space-y-6">
      <SectionHeader title="Analytics" subtitle="Insights financieros, patrones y distribución." actions={<Tabs tabs={['1M', '3M', '6M', '1Y']} active={range} onChange={setRange} />} />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Savings Rate" value={31.4} trend={2.3} icon={BarChart3} />
        <KpiCard title="Net Cashflow" value={14220} trend={1.2} icon={CircleDollarSign} />
        <KpiCard title="Volatility" value={8.9} trend={-0.8} icon={PieChart} />
        <KpiCard title="Forecast" value={16500} trend={3.1} icon={CalendarClock} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartContainer title="Histórico Income vs Expenses"><IncomeVsExpensesChart data={[{ month: 'Apr', income: 11800, expenses: 6400 }, { month: 'May', income: 12200, expenses: 6200 }, { month: 'Jun', income: 12900, expenses: 6700 }]} /></ChartContainer>
        <ChartContainer title="Distribución por categoría"><AssetAllocationChart data={[{ name: 'Housing', value: 34, color: '#2563EB' }, { name: 'Food', value: 24, color: '#10B981' }, { name: 'Transport', value: 18, color: '#F59E0B' }, { name: 'Leisure', value: 24, color: '#8B5CF6' }]} /></ChartContainer>
      </div>
    </div>
  );
}
