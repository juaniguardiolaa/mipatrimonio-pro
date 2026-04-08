import { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Badge } from './Badge';

export function KpiCard({
  title,
  value,
  trend,
  icon: Icon,
  currency = 'USD',
  unit = 'currency',
}: {
  title: string;
  value: number;
  trend: number;
  icon: LucideIcon;
  currency?: string;
  unit?: 'currency' | 'percent';
}) {
  const VALID_CURRENCIES = new Set(['USD', 'ARS', 'EUR', 'BRL']);
  const safeUnit = unit === 'percent' || !VALID_CURRENCIES.has(currency) ? 'percent' : 'currency';
  const positive = trend >= 0;
  const displayValue = safeUnit === 'percent' ? `${value.toFixed(1)}%` : formatCurrency(value, currency);
  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold">{displayValue}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-4"><Badge variant={positive ? 'success' : 'danger'}>{formatPercent(trend)}</Badge></div>
    </Card>
  );
}
