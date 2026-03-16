'use client';

import { ArrowDownAZ, ArrowUpAZ, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card, CardTitle } from './card';
import { Table, Td, Th } from './table';

type Column<T> = { key: keyof T; label: string; sortable?: boolean; render?: (row: T) => import('react').ReactNode };

export function DataTable<T extends { id: string }>({ title, columns, rows }: { title: string; columns: Column<T>[]; rows: T[] }) {
  const [sort, setSort] = useState<{ key: keyof T; asc: boolean } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const left = String(a[sort.key]);
      const right = String(b[sort.key]);
      return sort.asc ? left.localeCompare(right) : right.localeCompare(left);
    });
  }, [rows, sort]);

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <Th key={String(column.key)}>
                  <button className="inline-flex items-center gap-1" onClick={() => column.sortable && setSort((s) => ({ key: column.key, asc: s?.key === column.key ? !s.asc : true }))}>
                    {column.label}
                    {column.sortable ? (sort?.key === column.key && !sort.asc ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpAZ className="h-3 w-3" />) : null}
                  </button>
                </Th>
              ))}
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={row.id} className={index % 2 === 0 ? 'bg-muted/30 transition hover:bg-muted/60' : 'transition hover:bg-muted/60'}>
                {columns.map((column) => (
                  <Td key={String(column.key)}>{column.render ? column.render(row) : String(row[column.key])}</Td>
                ))}
                <Td><button className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"><Pencil className="h-3 w-3" />Editar</button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
