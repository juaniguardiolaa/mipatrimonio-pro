import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth/session';

type TableCheckRow = { exists: string | null };

async function verifyPrismaReadiness() {
  await prisma.$queryRaw`SELECT 1`;

  const [userTable, sessionTable] = await Promise.all([
    prisma.$queryRaw<TableCheckRow[]>`SELECT to_regclass('public."User"')::text AS exists`,
    prisma.$queryRaw<TableCheckRow[]>`SELECT to_regclass('public."Session"')::text AS exists`,
  ]);

  return {
    userTableExists: Boolean(userTable[0]?.exists),
    sessionTableExists: Boolean(sessionTable[0]?.exists),
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => null);
  const email = body?.email?.toLowerCase()?.trim();
  const password = body?.password;
  const name = body?.name?.trim() || null;

  console.info('[auth.register] request received', {
    requestId,
    hasBody: Boolean(body),
    email,
    hasPassword: Boolean(password),
  });

  if (!email || !password) {
    return NextResponse.json({ message: 'Email y password son requeridos.' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }

  try {
    const readiness = await verifyPrismaReadiness();
    if (!readiness.userTableExists || !readiness.sessionTableExists) {
      console.error('[auth.register] prisma schema not ready', { requestId, readiness });
      return NextResponse.json(
        {
          message: 'Base de datos no migrada. Ejecutar prisma migrate deploy en producción.',
          readiness,
        },
        { status: 503 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: 'Ya existe una cuenta con este email.' }, { status: 409 });
    }

    console.info('[auth.register] creating user', { requestId, email });

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
  } catch (error) {
    console.error('[auth.register] fatal error', {
      requestId,
      error,
      message: error instanceof Error ? error.message : 'unknown_error',
      stack: error instanceof Error ? error.stack : null,
    });

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Unknown registration error',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      },
      { status: 500 },
    );
  }
}
