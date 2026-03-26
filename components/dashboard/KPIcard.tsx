'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/Card';

type KPIcardProps = {
  title: string;
  value: string;
  subvalue?: string;
  trend?: string;
};

function KPIcardBase({ title, value, subvalue, trend }: KPIcardProps) {
  const isNegative = trend?.startsWith('-');
  const trendClass = isNegative ? 'text-rose-400' : 'text-emerald-400';

  return (
    <Card className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {subvalue ? <p className="mt-1 text-sm text-gray-400">{subvalue}</p> : null}
      {trend ? <p className={`mt-2 text-sm font-medium ${trendClass}`}>{trend}</p> : null}
    </Card>
  );
}

export const KPIcard = memo(KPIcardBase);
