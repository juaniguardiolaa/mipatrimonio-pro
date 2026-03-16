import { prisma } from '@/lib/db';

export type FxQuote = {
  symbol: 'USD_ARS_OFICIAL' | 'USD_ARS_MEP' | 'USD_ARS_CCL' | 'USD_ARS_BLUE';
  rate: number;
  source: string;
  timestamp: Date;
};

const FX_CACHE_MS = 60_000;

async function getCachedRate(symbol: FxQuote['symbol']) {
  const from = new Date(Date.now() - FX_CACHE_MS);
  return prisma.fxRate.findFirst({
    where: { symbol, timestamp: { gte: from } },
    orderBy: { timestamp: 'desc' },
  });
}

export async function getDollarRates(): Promise<FxQuote[]> {
  const endpoint = process.env.DOLAR_API_URL || 'https://dolarapi.com/v1/dolares';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`FX API ${res.status}`);
    const data = await res.json() as Array<{ casa: string; venta: number }>;

    const map: Record<string, FxQuote['symbol']> = {
      oficial: 'USD_ARS_OFICIAL',
      mep: 'USD_ARS_MEP',
      ccl: 'USD_ARS_CCL',
      blue: 'USD_ARS_BLUE',
    };

    return data
      .filter((row) => row.casa in map && Number(row.venta) > 0)
      .map((row) => ({
        symbol: map[row.casa],
        rate: Number(row.venta),
        source: 'DOLARAPI',
        timestamp: new Date(),
      }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshFxRates() {
  const quotes = await getDollarRates();
  if (quotes.length === 0) return [];

  await prisma.fxRate.createMany({
    data: quotes.map((q) => ({ symbol: q.symbol, rate: q.rate, source: q.source, timestamp: q.timestamp })),
  });

  return quotes;
}

export async function getFxRate(symbol: FxQuote['symbol']) {
  const cached = await getCachedRate(symbol);
  if (cached) return cached.rate;

  const quotes = await refreshFxRates();
  const quote = quotes.find((q) => q.symbol === symbol);
  if (quote) return quote.rate;

  const last = await prisma.fxRate.findFirst({ where: { symbol }, orderBy: { timestamp: 'desc' } });
  return last?.rate ?? null;
}

export async function convertArsToUsd(arsValue: number) {
  const ccl = await getFxRate('USD_ARS_CCL');
  if (!ccl || ccl <= 0) return null;
  return arsValue / ccl;
}
