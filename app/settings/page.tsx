'use client';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';

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
