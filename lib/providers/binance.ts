export type CryptoMarketQuote = {
  symbol: string;
  priceUsd: number;
  source: 'BINANCE';
  timestamp: Date;
};

const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/price';

export async function getCryptoPrice(symbol: string): Promise<CryptoMarketQuote | null> {
  const normalized = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${BINANCE_TICKER_URL}?symbol=${normalized}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json() as { symbol?: string; price?: string };
    const priceUsd = Number(data.price);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

    return {
      symbol: normalized.replace(/USDT$/, ''),
      priceUsd,
      source: 'BINANCE',
      timestamp: new Date(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
