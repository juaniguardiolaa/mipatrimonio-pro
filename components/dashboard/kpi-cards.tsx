import type { NetWorthSummary } from '@/types';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

export function KpiCards({ summary }: { summary: NetWorthSummary | null }) {
  const rows = [
    { label: 'Net Worth', value: summary ? formatCurrency(summary.netWorth) : '--' },
    { label: 'Assets Total', value: summary ? formatCurrency(summary.assetsTotal) : '--' },
    { label: 'Liabilities Total', value: summary ? formatCurrency(summary.liabilitiesTotal) : '--' },
    { label: 'Monthly Change', value: summary ? formatCurrency(summary.monthlyChange) : '--' }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {rows.map((item) => (
        <Card key={item.label}>
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
