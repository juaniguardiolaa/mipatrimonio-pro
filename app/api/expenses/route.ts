import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthSession } from '@/lib/auth/session';

function toNumber(value: unknown) {
  const amount = Number(value ?? null);
  return Number.isFinite(amount) ? amount : null;
}

export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const items = await prisma.expense.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json({ ok: true, items: items ?? [] });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const category = String(body?.category ?? 'Other').trim() || 'Other';
  const currency = String(body?.currency ?? 'USD').trim().toUpperCase() || 'USD';
  const amount = toNumber(body?.amount);
  const date = body?.date ? new Date(String(body.date)) : null;
  const notes = body?.notes ? String(body.notes) : null;

  if (!name || amount === null || amount <= 0 || !date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ message: 'Invalid expense payload.' }, { status: 400 });
  }

  const item = await prisma.expense.create({
    data: {
      userId,
      name,
      category,
      amount,
      currency,
      date,
      notes,
    },
  });

  return NextResponse.json({ ok: true, item }, { status: 201 });
}
