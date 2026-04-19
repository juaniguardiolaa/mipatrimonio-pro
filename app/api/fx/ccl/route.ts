import { NextResponse } from 'next/server';

const CACHE_TTL_MS = 60_000;
let cclCache: { value: number | null; ts: number } | null = null;

async function fetchWithTimeout(url: string, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET() {
  if (cclCache && Date.now() - cclCache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ccl: cclCache.value });
  }

  try {
    const dolarApi = await fetchWithTimeout('https://dolarapi.com/v1/dolares/contadoconliqui');
    if (dolarApi.ok) {
      const data = await dolarApi.json().catch(() => ({}));
      const ccl = Number((data as any).venta ?? null);
      if (Number.isFinite(ccl) && ccl > 0) {
        cclCache = { value: ccl, ts: Date.now() };
        return NextResponse.json({ ccl });
      }
    }
  } catch {}

  try {
    const bluelytics = await fetchWithTimeout('https://api.bluelytics.com.ar/v2/latest');
    if (bluelytics.ok) {
      const data = await bluelytics.json().catch(() => ({}));
      const ccl = Number((data as any)?.ccl?.value_sell ?? null);
      if (Number.isFinite(ccl) && ccl > 0) {
        cclCache = { value: ccl, ts: Date.now() };
        return NextResponse.json({ ccl });
      }
    }
  } catch {}

  cclCache = { value: null, ts: Date.now() };
  return NextResponse.json({ ccl: null });
}
