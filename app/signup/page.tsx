'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.message || 'No se pudo crear la cuenta.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">Empezá a gestionar tu patrimonio con datos reales y pricing automático.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">Nombre</label>
            <Input id="name" type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input id="email" type="email" placeholder="tu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
            <Input id="password" type="password" placeholder="Mínimo 8 caracteres" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirmPassword">Confirmar contraseña</label>
            <Input id="confirmPassword" type="password" placeholder="Repetí tu contraseña" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <Button className="w-full" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta'}</Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">Iniciar sesión</Link>
        </p>
      </Card>
    </div>
  );
}
