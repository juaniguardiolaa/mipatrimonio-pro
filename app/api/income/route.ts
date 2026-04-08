import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthSession } from '@/lib/auth/session';
 
export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
 
  const items = await prisma.income.findMany({
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
  const source = body?.source?.trim();
  const category = body?.category?.trim() || 'Other';
  const amount = Number(body?.amount);
  const currency = body?.currency?.trim() || 'USD';
  const date = body?.date ? new Date(body.date) : null;
 
  if (!source || !Number.isFinite(amount) || amount <= 0 || !date || isNaN(date.getTime())) {
    return NextResponse.json(
      { message: 'source, amount y date son obligatorios.' },
      { status: 400 },
    );
  }
 
  const item = await prisma.income.create({
    data: { userId, source, category, amount, currency, date },
  });
 
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
 
