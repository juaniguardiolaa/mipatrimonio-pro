'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Bot } from 'lucide-react';

export default function AiAnalysisPage() {
  return <div className="space-y-6"><SectionHeader title="AI Analysis" subtitle="Insights automatizados para optimizar tu patrimonio." /><EmptyState icon={Bot} title="Sin análisis recientes" description="Ejecuta un análisis para obtener recomendaciones inteligentes." actionLabel="Ejecutar análisis" /></div>;
}
