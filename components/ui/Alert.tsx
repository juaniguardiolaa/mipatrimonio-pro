import { ReactNode } from 'react';

export function Alert({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
