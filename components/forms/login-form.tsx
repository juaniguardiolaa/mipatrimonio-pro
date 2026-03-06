'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const [email, setEmail] = useState('demo@mipatrimonio.pro');
  const [password, setPassword] = useState('demo12345');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await signIn('credentials', {
      email,
      password,
      callbackUrl: '/dashboard'
    });
  }

  return (
    <Card className="w-full max-w-md">
      <h1 className="mb-4 text-xl font-bold">Iniciar sesión</h1>
      <form onSubmit={submit} className="space-y-3">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button type="submit" className="w-full">
          Ingresar
        </Button>
      </form>
    </Card>
  );
}
