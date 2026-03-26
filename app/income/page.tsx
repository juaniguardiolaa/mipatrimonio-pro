'use client';

import { DataTable } from '@/components/ui/DataTable';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/Badge';

const rows = [
  { id: '1', date: '2026-03-01', source: 'Salary', category: 'Work', amount: '$8,500.00' },
  { id: '2', date: '2026-03-05', source: 'Dividends', category: 'Investments', amount: '$1,120.30' },
];

export default function IncomePage() {
  return <div className="space-y-6"><SectionHeader title="Income" subtitle="Ingresos por fuente y periodicidad" /><DataTable title="Income Records" columns={[{ key: 'date', label: 'Fecha', sortable: true }, { key: 'source', label: 'Fuente', sortable: true }, { key: 'category', label: 'Categoría', sortable: true, render: (row) => <Badge variant="success">{row.category}</Badge> }, { key: 'amount', label: 'Monto', sortable: true }]} rows={rows} /></div>;
}
