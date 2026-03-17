import { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'bg-muted text-muted-foreground',
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      primary: 'bg-primary/15 text-primary',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export function Badge({ className, variant, children }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
