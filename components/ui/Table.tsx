import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}
export function Th({ children }: { children: ReactNode }) { return <th className="px-3 py-2 text-left font-semibold text-muted-foreground">{children}</th>; }
export function Td({ children, className }: { children: ReactNode; className?: string }) { return <td className={cn('px-3 py-3', className)}>{children}</td>; }
