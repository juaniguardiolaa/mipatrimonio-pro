'use client';

import { DataTable } from '@/components/ui/DataTable';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/Badge';

const rows = [
  { id: '1', date: '2026-03-02', name: 'Rent', category: 'Housing', amount: '$2,100.00' },
  { id: '2', date: '2026-03-06', name: 'Groceries', category: 'Food', amount: '$540.55' },
];

export default function ExpensesPage() {
  return <div className="space-y-6"><SectionHeader title="Expenses" subtitle="Control de gastos y desvíos" /><DataTable title="Expense Records" columns={[{ key: 'date', label: 'Fecha', sortable: true }, { key: 'name', label: 'Concepto', sortable: true }, { key: 'category', label: 'Categoría', sortable: true, render: (row) => <Badge variant="danger">{row.category}</Badge> }, { key: 'amount', label: 'Monto', sortable: true }]} rows={rows} /></div>;
}
