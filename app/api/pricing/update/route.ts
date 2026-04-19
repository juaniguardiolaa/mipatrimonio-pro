import { NextRequest, NextResponse } from 'next/server';
import { executePricingUpdate } from '@/lib/services/pricing.service';
import { getAuthSession } from '@/lib/auth/session';

const RATE_LIMIT_MS = 60_000;
const TIMEOUT_MS = 25_000;
let lastUpdateExecution = 0;
let lastRateLimitResponse: Record<string, unknown> | null = null;

async function isAuthorized(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') return true;

  const expected = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const hasValidCronToken = Boolean(expected) && auth === `Bearer ${expected}`;

  if (hasValidCronToken) {
    console.info('[pricing.update] authorized by CRON_SECRET');
    return true;
  }

  const session = await getAuthSession();
  if (session?.user?.id) {
    console.info('[pricing.update] authorized by user session', { userId: session.user.id });
    return true;
  }

  console.warn('[pricing.update] unauthorized request', {
    hasAuthorizationHeader: Boolean(auth),
    hasExpectedCronSecret: Boolean(expected),
  });

  return false;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  if (now - lastUpdateExecution < RATE_LIMIT_MS && lastRateLimitResponse) {
    return NextResponse.json(lastRateLimitResponse);
  }

  if (now - lastUpdateExecution < RATE_LIMIT_MS) {
    return NextResponse.json({ message: 'Pricing update skipped (too soon)' });
  }

  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('pricing update timeout')), TIMEOUT_MS);
    });

    const result = await Promise.race([executePricingUpdate(), timeout]);
    lastUpdateExecution = now;
    lastRateLimitResponse = result;
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
}
