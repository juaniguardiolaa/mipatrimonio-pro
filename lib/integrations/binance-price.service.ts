export type CryptoPriceQuote = {
  symbol: string;
  price: number;
  timestamp: Date;
};

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3/ticker/price';

export async function getBinancePrice(symbol: string): Promise<CryptoPriceQuote | null> {
  const normalized = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${BINANCE_BASE_URL}?symbol=${normalized}`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return null;

    const data = await response.json() as { symbol: string; price: string };
    return {
      symbol: data.symbol.replace('USDT', ''),
      price: Number(data.price),
      timestamp: new Date(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
