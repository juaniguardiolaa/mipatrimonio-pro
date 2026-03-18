export type CryptoPriceQuote = {
  symbol: string;
  price: number;
  timestamp: Date;
};

const COINGECKO_SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LTC: 'litecoin',
  LINK: 'chainlink',
};

function normalizeCryptoSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/USDT$/, '');
}

export async function getBinancePrice(symbol: string): Promise<CryptoPriceQuote | null> {
  const normalized = normalizeCryptoSymbol(symbol);
  const id = COINGECKO_ID_MAP[normalized];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    console.log('Pricing asset:', symbol);
    console.log('Normalized:', normalized);
    console.log('Using CoinGecko for', normalized);
    if (!id) return null;

    const response = await fetch(`${COINGECKO_SIMPLE_PRICE_URL}?ids=${encodeURIComponent(id)}&vs_currencies=usd`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    });
    if (!response.ok) {
      console.error('CoinGecko HTTP error', response.status);
      return null;
    }

    const data = await response.json() as Record<string, { usd?: number }>;
    console.log('CoinGecko API response:', data);
    const price = Number(data[id]?.usd ?? null);
    console.log('Price result:', price);
    if (!price || Number.isNaN(price)) {
      console.error('Invalid CoinGecko response', data);
      return null;
    }

    return {
      symbol: normalized,
      price,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('CoinGecko error', {
      symbol,
      normalized,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
