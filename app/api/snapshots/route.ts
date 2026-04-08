import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthSession } from '@/lib/auth/session';

function normalizeMonth(value: unknown) {
  const parsed = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(parsed)) return null;
  return parsed;
}

function toNumber(value: unknown) {
  const amount = Number(value ?? null);
  return Number.isFinite(amount) ? amount : null;
}

export async function GET(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = normalizeMonth(searchParams.get('month'));

  if (month) {
    const snapshot = await prisma.snapshot.findUnique({
      where: { userId_date: { userId, date: month } },
    });
    return NextResponse.json({ ok: true, snapshot: snapshot ?? null });
  }

  const snapshots = await prisma.snapshot.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
    take: 24,
  });

  return NextResponse.json({ ok: true, snapshots });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const date = normalizeMonth(body?.date);
  const netWorthUsd = toNumber(body?.netWorthUsd);
  const netWorthArs = toNumber(body?.netWorthArs);
  const totalIncome = toNumber(body?.totalIncome);
  const totalExpenses = toNumber(body?.totalExpenses);
  const savingsRate = toNumber(body?.savingsRate);

  if (!date || netWorthUsd === null || netWorthArs === null || totalIncome === null || totalExpenses === null || savingsRate === null) {
    return NextResponse.json({ message: 'Invalid snapshot payload.' }, { status: 400 });
  }

  const snapshot = await prisma.snapshot.upsert({
    where: { userId_date: { userId, date } },
    update: {
      netWorthUsd,
      netWorthArs,
      totalIncome,
      totalExpenses,
      savingsRate,
    },
    create: {
      userId,
      date,
      netWorthUsd,
      netWorthArs,
      totalIncome,
      totalExpenses,
      savingsRate,
    },
  });

  return NextResponse.json({ ok: true, snapshot }, { status: 201 });
}
