import { NextRequest, NextResponse } from 'next/server';
import { getStockPrice } from '@/lib/providers/yahoo';
import { getAuthSession } from '@/lib/auth/session';
 
/**
 * GET /api/pricing/quote?symbol=AAPL
 *
 * Internal proxy that fetches a single equity price from Yahoo Finance
 * server-side, avoiding CORS restrictions when called from the browser.
 * Results are cached via the PriceSnapshot table by the underlying service.
 */
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
 
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ message: 'symbol is required' }, { status: 400 });
  }
 
  try {
    const quote = await getStockPrice(symbol);
 
    if (!quote) {
      return NextResponse.json(
        { ok: false, price: null, message: 'Price not available' },
        { status: 404 },
      );
    }
 
    return NextResponse.json(
      { ok: true, symbol: quote.symbol, price: quote.priceUsd, currency: quote.currency },
      {
        headers: {
          // 30-second client cache — matches the frontend refresh interval
          'Cache-Control': 'private, max-age=30',
        },
      },
    );
  } catch (error) {
    console.error('[api/pricing/quote] error', {
      symbol,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, price: null, message: 'Internal error' },
      { status: 500 },
    );
  }
}
 
