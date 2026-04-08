import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ message: 'symbol required' }, { status: 400 });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ price: null }, { status: 200 });

    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    return NextResponse.json({ price: typeof price === 'number' && price > 0 ? price : null });
  } catch {
    return NextResponse.json({ price: null });
  }
}
