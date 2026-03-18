import { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-10 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', props.className)} {...props} />;
}
