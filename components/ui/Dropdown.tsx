'use client';

import { ReactNode, useState } from 'react';
import { Button } from './Button';

export function Dropdown({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>{label}</Button>
      {open && <div className="absolute right-0 mt-2 min-w-40 rounded-lg border border-border bg-card p-2 shadow-soft">{children}</div>}
    </div>
  );
}
