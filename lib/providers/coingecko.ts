/**
 * Canonical crypto price provider using CoinGecko simple/price API.
 *
 * This module replaces BOTH:
 *   - lib/integrations/binance-price.service.ts  (used by the backend cron path)
 *   - lib/providers/binance.ts                   (used by pricing.service.ts)
 *
 * All imports across the codebase should point here.
 */
 
export type CryptoMarketQuote = {
  symbol: string;
  priceUsd: number;
  source: 'COINGECKO';
  timestamp: Date;
};
 
const COINGECKO_SIMPLE_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price';
 
/**
 * Maps uppercase base symbols to CoinGecko coin IDs.
 * Add new entries here — do NOT maintain a second copy elsewhere.
 */
export const COINGECKO_ID_MAP: Record<string, string> = {
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
  UNI: 'uniswap',
  AAVE: 'aave',
  ATOM: 'cosmos',
  FIL: 'filecoin',
  NEAR: 'near',
  OP: 'optimism',
  ARB: 'arbitrum',
};
 
/**
 * Normalise a symbol to its CoinGecko base form.
 * Strips USDT/USDC/BUSD suffixes and uppercases.
 * Examples: "btcusdt" → "BTC", "ETH" → "ETH"
 */
export function normalizeCryptoSymbol(symbol: string): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/USDT$|USDC$|BUSD$/, '');
}
 
/**
 * Fetch the USD price for a single crypto symbol.
 * Returns null if the symbol is not in the known map or the request fails.
 */
export async function getCryptoPrice(
  symbol: string,
): Promise<CryptoMarketQuote | null> {
  const normalized = normalizeCryptoSymbol(symbol);
  const id = COINGECKO_ID_MAP[normalized];
 
  if (!id) {
    console.warn('[coingecko] symbol_not_mapped', { symbol, normalized });
    return null;
  }
 
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
 
  try {
    const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
 
    if (!response.ok) {
      console.error('[coingecko] http_error', { symbol: normalized, status: response.status });
      return null;
    }
 
    const data = (await response.json()) as Record<string, { usd?: number }>;
    const priceUsd = Number(data[id]?.usd ?? null);
 
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      console.error('[coingecko] invalid_price', { symbol: normalized, data });
      return null;
    }
 
    console.log('[coingecko] price_fetched', { symbol: normalized, priceUsd });
    return { symbol: normalized, priceUsd, source: 'COINGECKO', timestamp: new Date() };
  } catch (error) {
    console.error('[coingecko] fetch_error', {
      symbol: normalized,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
 
/**
 * Batch-fetch prices for multiple symbols in a single CoinGecko request.
 * Symbols not present in COINGECKO_ID_MAP are skipped with a warning.
 */
export async function getCryptoPricesBatch(
  symbols: string[],
): Promise<Record<string, number | null>> {
  const uniqueNormalized = [
    ...new Set(symbols.map(normalizeCryptoSymbol)),
  ];
 
  const symbolToId = new Map<string, string>();
  const unknownSymbols: string[] = [];
 
  for (const sym of uniqueNormalized) {
    const id = COINGECKO_ID_MAP[sym];
    if (id) {
      symbolToId.set(sym, id);
    } else {
      unknownSymbols.push(sym);
    }
  }
 
  if (unknownSymbols.length > 0) {
    console.warn('[coingecko] batch_symbols_not_mapped', { unknownSymbols });
  }
 
  const result: Record<string, number | null> = {};
  uniqueNormalized.forEach((sym) => {
    result[sym] = null;
  });
 
  if (symbolToId.size === 0) return result;
 
  const uniqueIds = [...new Set(Array.from(symbolToId.values()))];
  const idsParam = encodeURIComponent(uniqueIds.join(','));
 
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
 
  try {
    const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${idsParam}&vs_currencies=usd`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
 
    if (!response.ok) {
      console.error('[coingecko] batch_http_error', { status: response.status });
      return result;
    }
 
    const data = (await response.json()) as Record<string, { usd?: number }>;
 
    for (const [sym, id] of symbolToId.entries()) {
      const price = Number(data[id]?.usd ?? null);
      result[sym] = Number.isFinite(price) && price > 0 ? price : null;
    }
 
    console.log('[coingecko] batch_fetched', {
      requested: uniqueNormalized.length,
      found: Object.values(result).filter((v) => v !== null).length,
    });
 
    return result;
  } catch (error) {
    console.error('[coingecko] batch_fetch_error', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
 
