import { LucideIcon } from 'lucide-react';
import { Button } from './button';

export function EmptyState({ icon: Icon, title, description, actionLabel }: { icon: LucideIcon; title: string; description: string; actionLabel: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">{description}</p>
      <Button>{actionLabel}</Button>
    </div>
  );
}
