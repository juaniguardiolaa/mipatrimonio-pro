export type CryptoMarketQuote = {
  symbol: string;
  priceUsd: number;
  source: 'COINGECKO';
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

export function normalizeCryptoSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/USDT$/, '');
}

export async function getCryptoPrice(symbol: string): Promise<CryptoMarketQuote | null> {
  const normalized = normalizeCryptoSymbol(symbol);
  const id = COINGECKO_ID_MAP[normalized];

  console.log('Pricing asset:', symbol);
  console.log('Normalized:', normalized);
  console.log('Using CoinGecko for', normalized);

  if (!id) {
    console.warn('CoinGecko symbol not mapped', { symbol, normalized });
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
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

    const priceUsd = Number(data[id]?.usd ?? null);
    console.log('Price result:', priceUsd);

    if (!priceUsd || Number.isNaN(priceUsd)) {
      console.error('Invalid CoinGecko response', data);
      return null;
    }

    return {
      symbol: normalized,
      priceUsd,
      source: 'COINGECKO',
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('CoinGecko error', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
