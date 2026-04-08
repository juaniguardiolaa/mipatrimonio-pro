import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dolarApi = await fetch('https://dolarapi.com/v1/dolares/contadoconliqui', { cache: 'no-store' });
    if (dolarApi.ok) {
      const data = await dolarApi.json().catch(() => ({}));
      const ccl = Number((data as any).venta ?? null);
      if (Number.isFinite(ccl) && ccl > 0) return NextResponse.json({ ccl });
    }
  } catch {}

  try {
    const bluelytics = await fetch('https://api.bluelytics.com.ar/v2/latest', { cache: 'no-store' });
    if (bluelytics.ok) {
      const data = await bluelytics.json().catch(() => ({}));
      const ccl = Number((data as any)?.ccl?.value_sell ?? null);
      if (Number.isFinite(ccl) && ccl > 0) return NextResponse.json({ ccl });
    }
  } catch {}

  return NextResponse.json({ ccl: null });
}
