import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Building2 } from 'lucide-react';

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Accounts" subtitle="Conexiones bancarias, brokers y custodios." />
      <EmptyState icon={Building2} title="No hay cuentas vinculadas" description="Conecta una cuenta para empezar a consolidar tu patrimonio." actionLabel="Agregar cuenta" />
    </div>
  );
}
