import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthSession } from '@/lib/auth/session';
 
export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
 
  const items = await prisma.expense.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 200,
  });
 
  return NextResponse.json({ ok: true, items });
}
 
export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
 
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const category = body?.category?.trim() || 'Other';
  const amount = Number(body?.amount);
  const currency = body?.currency?.trim() || 'USD';
  const date = body?.date ? new Date(body.date) : null;
 
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date || isNaN(date.getTime())) {
    return NextResponse.json(
      { message: 'name, amount y date son obligatorios.' },
      { status: 400 },
    );
  }
 
  const item = await prisma.expense.create({
    data: { userId, name, category, amount, currency, date },
  });
 
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
 
