import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" subtitle="Preferencias de visualización y cuenta." />
      <Card className="space-y-4 max-w-2xl">
        <Input placeholder="Nombre del portfolio" />
        <Input placeholder="Moneda por defecto" />
        <Separator />
        <Button className="w-fit">Guardar cambios</Button>
      </Card>
    </div>
  );
}
