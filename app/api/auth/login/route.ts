import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/auth/session';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase()?.trim();
  const password = body?.password;

  console.info('[auth.login] request received', {
    requestId,
    email,
    hasPassword: Boolean(password),
  });

  if (!email || !password) {
    return NextResponse.json({ message: 'Credenciales incompletas.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    console.info('[auth.login] invalid credentials', { requestId, email });
    return NextResponse.json({ message: 'Email o contraseña inválidos.' }, { status: 401 });
  }

  await createSession(user.id);
  console.info('[auth.login] session created', { requestId, userId: user.id, email: user.email });

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}
