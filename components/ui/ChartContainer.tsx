import { ReactNode } from 'react';
import { Card, CardTitle } from './Card';

export function ChartContainer({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="h-full"><CardTitle>{title}</CardTitle><div className="mt-4">{children}</div></Card>;
}
