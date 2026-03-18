export type CryptoMarketQuote = {
  symbol: string;
  priceUsd: number;
  source: 'BINANCE';
  timestamp: Date;
};

const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/price';

export function normalizeCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('USDT')) return normalized;
  return `${normalized}USDT`;
}

export async function getCryptoPrice(symbol: string): Promise<CryptoMarketQuote | null> {
  const normalized = normalizeCryptoSymbol(symbol);
  console.log('Pricing asset:', symbol);
  console.log('Normalized:', normalized);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const url = `${BINANCE_TICKER_URL}?symbol=${normalized}`;
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Binance HTTP error', response.status);
      return null;
    }

    const data = await response.json() as { symbol?: string; price?: string };
    console.log('Binance API response:', data);

    const priceUsd = parseFloat(data.price ?? 'NaN');
    console.log('Price result:', priceUsd);

    if (!priceUsd || Number.isNaN(priceUsd)) {
      console.error('Invalid Binance response', data);
      return null;
    }

    return {
      symbol: normalized.replace(/USDT$/, ''),
      priceUsd,
      source: 'BINANCE',
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Binance provider failed', {
      symbol,
      normalized,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
