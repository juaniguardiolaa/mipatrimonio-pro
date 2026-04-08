import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';

const cryptoCache = new Map<string, { prices: Record<string, number>; ts: number }>();
const CACHE_TTL = 60_000;

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids') ?? '';
  if (!ids) return NextResponse.json({ prices: {} });

  const cacheKey = ids;
  const cached = cryptoCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ prices: cached.prices });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return NextResponse.json({ prices: {} });

    const data = await res.json() as Record<string, { usd?: number }>;
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      if (typeof val.usd === 'number' && val.usd > 0) prices[id] = val.usd;
    }

    cryptoCache.set(cacheKey, { prices, ts: Date.now() });
    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json({ prices: {} });
  }
}
