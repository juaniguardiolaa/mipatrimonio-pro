import { NextResponse } from 'next/server';
import { getFxRate } from '@/lib/pricing/fx.service';
import { getAuthSession } from '@/lib/auth/session';
 
/**
 * GET /api/fx/ccl
 *
 * Returns the current USD/ARS CCL exchange rate.
 * Fetches from the database cache first; refreshes if stale.
 * All external FX calls happen server-side to avoid CORS issues.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
 
  try {
    const ccl = await getFxRate('USD_ARS_CCL');
 
    if (!ccl || ccl <= 0) {
      console.warn('[api/fx/ccl] rate_unavailable');
      return NextResponse.json(
        { ok: false, ccl: null, message: 'CCL rate not available' },
        { status: 503 },
      );
    }
 
    return NextResponse.json({ ok: true, ccl }, {
      headers: {
        // Allow the client to cache for 60 s, matching our DB cache TTL
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('[api/fx/ccl] error', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { ok: false, ccl: null, message: 'Internal error fetching FX rate' },
      { status: 500 },
    );
  }
}
 
