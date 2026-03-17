'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Goal } from 'lucide-react';

export default function GoalsPage() {
  return <div className="space-y-6"><SectionHeader title="Goals" subtitle="Objetivos financieros y progreso." /><EmptyState icon={Goal} title="Aún no hay metas" description="Crea una meta para proyectar aportes y fecha objetivo." actionLabel="Crear meta" /></div>;
}
