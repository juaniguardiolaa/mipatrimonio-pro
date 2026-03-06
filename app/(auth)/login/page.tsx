import Link from 'next/link';
import { LoginForm } from '@/components/forms/login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <LoginForm />
      <p className="text-sm text-slate-500">
        ¿No tienes cuenta? <Link className="text-indigo-600" href="/signup">Create one</Link>
      </p>
    </main>
  );
}
