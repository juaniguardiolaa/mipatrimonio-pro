import { useEffect, useMemo, useRef, useState } from 'react';

type AssetForPricing = {
  id: string;
  symbol: string;
  assetType: string;
  purchasePrice?: number;
};
 
export type PriceResult = {
  price: number | null;
  source: 'market' | 'fallback';
};
 
// ── Helpers ──────────────────────────────────────────────────────────────────
 
function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}
 
function normalizeCryptoBaseSymbol(symbol: string): string {
  return normalizeSymbol(symbol)
    .replace(/USDT$|USDC$|BUSD$/, '');
}
 
async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 5000,
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
 
const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', MATIC: 'matic-network',
  AVAX: 'avalanche-2', DOT: 'polkadot', LINK: 'chainlink', LTC: 'litecoin',
  UNI: 'uniswap', AAVE: 'aave', ATOM: 'cosmos', FIL: 'filecoin',
  NEAR: 'near', OP: 'optimism', ARB: 'arbitrum',
};
 
async function fetchCryptoBatchPricesUsd(
  symbols: string[],
): Promise<Record<string, number | null>> {
  const unique = [...new Set(symbols.map(normalizeCryptoBaseSymbol))];
  const result: Record<string, number | null> = {};
  unique.forEach((s) => { result[s] = null; });
 
  const symbolToId = new Map<string, string>();
  for (const sym of unique) {
    const id = COINGECKO_ID_MAP[sym];
    if (id) symbolToId.set(sym, id);
    else console.warn('[prices:coingecko] symbol_not_mapped', { sym });
  }
 
  if (symbolToId.size === 0) return result;
 
  const ids = [...new Set(Array.from(symbolToId.values()))].join(',');
  const data = await fetchJsonWithTimeout<Record<string, { usd?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`,
  );
 
  if (!data) return result;
 
  for (const [sym, id] of symbolToId.entries()) {
    const price = Number(data[id]?.usd ?? null);
    result[sym] = Number.isFinite(price) && price > 0 ? price : null;
  }
 
  return result;
}
 
/**
 * Fetch a stock/ETF/CEDEAR price in USD via Yahoo Finance.
 * NOTE: This direct browser call works in development.
 * In production the request goes through the internal /api/pricing/quote proxy
 * route (if available) to avoid CORS issues.
 */
async function fetchStockPriceUsd(symbol: string): Promise<number | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
 
  // Prefer the internal proxy to avoid CORS; fall back to direct call in dev
  const internalUrl = `/api/pricing/quote?symbol=${encodeURIComponent(normalized)}`;
  const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?interval=1d&range=1d`;
 
  // Try internal route first
  const internalData = await fetchJsonWithTimeout<{ price?: number }>(internalUrl);
  if (internalData?.price && Number.isFinite(internalData.price) && internalData.price > 0) {
    return internalData.price;
  }
 
  // Fall back to direct Yahoo call (works in dev, may fail in prod due to CORS)
  const chartData = await fetchJsonWithTimeout<{
    chart?: {
      result?: Array<{ meta?: { regularMarketPrice?: number } }>;
    };
  }>(directUrl);
 
  const price = Number(
    chartData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null,
  );
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}
 
// ── Hook ─────────────────────────────────────────────────────────────────────
 
const PRICE_CACHE_TTL_MS = 60_000;
const REFRESH_INTERVAL_MS = 30_000;
const BATCH_SIZE = 3;
 
export function usePrices(assets: AssetForPricing[]) {
  const [prices, setPrices] = useState<Record<string, PriceResult>>({});
 
  // ── FIX: stable dependency key — avoids JSON.stringify in useEffect deps ──
  // Build a primitive string only from the fields that actually affect pricing.
  // useMemo ensures the string reference is stable between renders when the
  // underlying data hasn't changed.
  const assetKey = useMemo(
    () =>
      assets
        .map((a) => `${a.id}:${a.symbol}:${a.assetType}`)
        .sort()
        .join('|'),
    [assets],
  );
 
  const cacheRef = useRef<
    Record<string, { price: number | null; ts: number }>
  >({});
  const isFetchingRef = useRef(false);
 
  useEffect(() => {
    if (!assets || assets.length === 0) {
      setPrices({});
      return;
    }
 
    let isMounted = true;
    let intervalId: number | null = null;
 
    const fetchPrices = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
 
      const newPrices: Record<string, PriceResult> = {};
      const now = Date.now();
 
      try {
        for (let i = 0; i < assets.length; i += BATCH_SIZE) {
          const batch = assets.slice(i, i + BATCH_SIZE);
 
          // Batch-fetch all crypto in this slice
          const cryptoAssets = batch.filter((a) => a.assetType === 'CRYPTO');
          const cryptoPricesBySymbol =
            cryptoAssets.length > 0
              ? await fetchCryptoBatchPricesUsd(cryptoAssets.map((a) => a.symbol))
              : {};
 
          await Promise.all(
            batch.map(async (asset) => {
              const normalizedSymbol = normalizeSymbol(asset.symbol);
              const cacheKey = `${asset.assetType}:${normalizedSymbol}`;
              const cached = cacheRef.current[cacheKey];
              let price: number | null = null;
 
              if (cached && now - cached.ts < PRICE_CACHE_TTL_MS) {
                price = cached.price;
              } else {
                if (asset.assetType === 'CRYPTO') {
                  price =
                    cryptoPricesBySymbol[normalizeCryptoBaseSymbol(normalizedSymbol)] ??
                    null;
                } else if (
                  // ── FIX: ETF was missing from this condition ───────────
                  asset.assetType === 'STOCK' ||
                  asset.assetType === 'ETF' ||
                  asset.assetType === 'CEDEAR'
                ) {
                  price = await fetchStockPriceUsd(normalizedSymbol);
                }
                // CASH and BOND: no external price fetch needed here —
                // handled separately in usePortfolio.
 
                cacheRef.current[cacheKey] = { price, ts: Date.now() };
              }
 
              if (price !== null && price > 0) {
                newPrices[asset.id] = { price, source: 'market' };
              } else if (asset.purchasePrice && asset.purchasePrice > 0) {
                newPrices[asset.id] = { price: asset.purchasePrice, source: 'fallback' };
                console.warn('[prices:fallback]', {
                  symbol: normalizedSymbol,
                  type: asset.assetType,
                });
              } else {
                newPrices[asset.id] = { price: null, source: 'fallback' };
                console.warn('[prices:no_price]', {
                  symbol: normalizedSymbol,
                  type: asset.assetType,
                });
              }
            }),
          );
        }
 
        if (isMounted) setPrices(newPrices);
      } finally {
        isFetchingRef.current = false;
      }
    };
 
    fetchPrices().catch(() => undefined);
 
    intervalId = window.setInterval(() => {
      fetchPrices().catch(() => undefined);
    }, REFRESH_INTERVAL_MS) as unknown as number;
 
    return () => {
      isMounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
    // ── FIX: depend on the stable memoized key, not JSON.stringify(assets) ──
  }, [assetKey]); // eslint-disable-line react-hooks/exhaustive-deps
 
  return prices;
}
 
