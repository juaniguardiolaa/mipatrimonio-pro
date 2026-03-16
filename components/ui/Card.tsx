import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

type CardProps = {
  title?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({ title, actions, className, children }: CardProps) {
  return (
    <section className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
