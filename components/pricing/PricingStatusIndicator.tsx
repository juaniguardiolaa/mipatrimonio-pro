import { cn } from '@/lib/utils';

type PricingStatus = 'idle' | 'updating' | 'updated' | 'error';

const labels: Record<PricingStatus, string> = {
  idle: 'Precios en espera de actualización',
  updating: 'Actualizando precios...',
  updated: 'Precios actualizados',
  error: 'Error al actualizar precios',
};

export function PricingStatusIndicator({ status, lastUpdatedAt }: { status: PricingStatus; lastUpdatedAt: Date | null }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span className={cn('h-2 w-2 rounded-full', status === 'updating' ? 'animate-pulse bg-amber-500' : status === 'updated' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-slate-400')} />
      <span>{labels[status]}</span>
      {lastUpdatedAt ? <span className="hidden sm:inline">· {lastUpdatedAt.toLocaleTimeString()}</span> : null}
    </div>
  );
}
