import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const accounts = await prisma.holdingAccount.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ ok: true, accounts });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const institution = body?.institution?.trim();
  const type = body?.type?.trim() || 'BROKER';
  const currency = body?.currency?.trim() || 'ARS';

  if (!name || !institution) {
    return NextResponse.json({ message: 'Nombre e institución son obligatorios.' }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findFirst({ where: { userId } })
    ?? await prisma.portfolio.create({ data: { userId, name: 'Portfolio Principal' } });

  const account = await prisma.holdingAccount.create({
    data: { userId, portfolioId: portfolio.id, name, institution, type, currency },
  });

  return NextResponse.json({ ok: true, account }, { status: 201 });
}
