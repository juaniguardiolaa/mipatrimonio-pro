import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth/session';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase()?.trim();
  const password = body?.password;
  const name = body?.name?.trim() || null;

  if (!email || !password) {
    return NextResponse.json({ message: 'Email y password son requeridos.' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: 'Ya existe una cuenta con este email.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      name,
      portfolios: {
        create: { name: 'Portfolio Principal' },
      },
    },
    select: { id: true, email: true },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true, user }, { status: 201 });
}
