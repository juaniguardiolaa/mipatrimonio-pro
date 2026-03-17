import { ReactNode } from 'react';
import { Button } from './Button';

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button></div>
        {children}
      </div>
    </div>
  );
}
