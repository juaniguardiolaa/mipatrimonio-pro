import { cn } from '@/lib/utils';

type MetricBadgeProps = { value: string; positive?: boolean };

export function MetricBadge({ value, positive = true }: MetricBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        positive
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
      )}
    >
      {value}
    </span>
  );
}
