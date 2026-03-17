import { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Badge } from './Badge';

export function KpiCard({ title, value, trend, icon: Icon, currency = 'USD' }: { title: string; value: number; trend: number; icon: LucideIcon; currency?: string }) {
  const positive = trend >= 0;
  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(value, currency)}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-4"><Badge variant={positive ? 'success' : 'danger'}>{formatPercent(trend)}</Badge></div>
    </Card>
  );
}
