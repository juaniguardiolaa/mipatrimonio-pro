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

async function fetchCryptoBatchPricesUsd(symbols: string[]): Promise<Record<string, number | null>> {
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => normalizeCryptoBaseSymbol(symbol))));
  if (uniqueSymbols.length === 0) return {};

  const explicitIdMap: Record<string, string> = {
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
    LINK: 'chainlink',
    LTC: 'litecoin',
  };

  const symbolToId = new Map<string, string>();
  for (const symbol of uniqueSymbols) {
    const id = explicitIdMap[symbol] ?? symbol.toLowerCase();
    symbolToId.set(symbol, id);
  }

  const ids = Array.from(new Set(Array.from(symbolToId.values()))).join(',');
  const data = await fetchJsonWithTimeout<{ prices: Record<string, number> }>(
    `/api/pricing/crypto?ids=${encodeURIComponent(ids)}`,
  );
 
  if (!data) return result;
 
  for (const [sym, id] of symbolToId.entries()) {
    const price = Number(data[id]?.usd ?? null);
    result[sym] = Number.isFinite(price) && price > 0 ? price : null;
  }

  uniqueSymbols.forEach((symbol) => {
    const id = symbolToId.get(symbol);
    const price = Number(id ? data?.prices?.[id] ?? null : null);
    result[symbol] = Number.isFinite(price) && price > 0 ? price : null;
  });

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
  const data = await fetchJsonWithTimeout<{ price?: number }>(
    `/api/pricing/quote?symbol=${encodeURIComponent(normalized)}`,
  );
  return data?.price && Number.isFinite(data.price) && data.price > 0 ? data.price : null;
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
              try {
                let price: number | null = null;
                const normalizedSymbol = normalizeSymbol(asset.symbol);
                const normalizedCryptoBase = normalizeCryptoBaseSymbol(asset.symbol);
                const cacheKey = `${asset.assetType}:${normalizedSymbol}`;
                const cached = cacheRef.current[cacheKey];

                if (cached && now - cached.ts < 60_000) {
                  price = cached.price;
                } else {
                  if (asset.assetType === 'CRYPTO') {
                    price = cryptoPricesBySymbol[normalizedCryptoBase] ?? null;
                  }

                  if (asset.assetType === 'STOCK' || asset.assetType === 'CEDEAR') {
                    price = await fetchStockPriceUsd(normalizedSymbol);
                  }

                  if (asset.assetType === 'BOND') {
                    price = asset.purchasePrice && asset.purchasePrice > 0 ? asset.purchasePrice : null;
                  }

                  if (asset.assetType === 'CEDEAR') {
                    // future: apply FX * ratio
                  }

                  cacheRef.current[cacheKey] = { price, ts: Date.now() };
                }

                if (price === null) {
                  console.warn('[pricing:failed]', {
                    symbol: normalizedSymbol,
                    assetType: asset.assetType,
                    provider: asset.assetType === 'CRYPTO' ? 'coingecko' : 'yahoo',
                  });
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
 
