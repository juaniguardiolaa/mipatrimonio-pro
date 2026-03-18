export type CryptoPriceQuote = {
  symbol: string;
  price: number;
  timestamp: Date;
};

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3/ticker/price';

function normalizeCryptoSymbol(symbol: string): string {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('USDT')) return normalized;
  return `${normalized}USDT`;
}

export async function getBinancePrice(symbol: string): Promise<CryptoPriceQuote | null> {
  const normalized = normalizeCryptoSymbol(symbol);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    console.log('Pricing asset:', symbol);
    console.log('Normalized:', normalized);
    const response = await fetch(`${BINANCE_BASE_URL}?symbol=${normalized}`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      console.error('Binance HTTP error', response.status);
      return null;
    }

    const data = await response.json() as { symbol: string; price: string };
    console.log('Binance API response:', data);
    const price = parseFloat(data?.price);
    console.log('Price result:', price);
    if (!price || Number.isNaN(price)) {
      console.error('Invalid Binance response', data);
      return null;
    }

    return {
      symbol: data.symbol.replace('USDT', ''),
      price,
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
