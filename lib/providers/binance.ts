export type CryptoMarketQuote = {
  symbol: string;
  priceUsd: number;
  source: 'BINANCE';
  timestamp: Date;
};

const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/price';

export async function getCryptoPrice(symbol: string): Promise<CryptoMarketQuote | null> {
  const normalized = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  console.log('Using Binance symbol:', normalized);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${BINANCE_TICKER_URL}?symbol=${normalized}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Binance API ${response.status} for ${normalized}`);
    }

    const data = await response.json() as { symbol?: string; price?: string };
    const priceUsd = parseFloat(data.price ?? 'NaN');
    console.log('Price USD:', priceUsd);

    if (priceUsd === null || priceUsd === undefined || Number.isNaN(priceUsd)) {
      throw new Error(`Invalid price for ${symbol}`);
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
