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

function normalizeCryptoSymbol(symbol: string) {
  const upper = normalizeSymbol(symbol);
  return upper.endsWith('USDT') ? upper : `${upper}USDT`;
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function normalizeCryptoBaseSymbol(symbol: string) {
  return normalizeCryptoSymbol(symbol).replace(/USDT$/, '').toUpperCase();
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 3000): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
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

  const result: Record<string, number | null> = {};
  if (!data) {
    uniqueSymbols.forEach((symbol) => {
      result[symbol] = null;
    });
    return result;
  }

  uniqueSymbols.forEach((symbol) => {
    const id = symbolToId.get(symbol);
    const price = Number(id ? data?.prices?.[id] ?? null : null);
    result[symbol] = Number.isFinite(price) && price > 0 ? price : null;
  });

  return result;
}

async function fetchStockPriceUsd(symbol: string): Promise<number | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  const data = await fetchJsonWithTimeout<{ price?: number }>(
    `/api/pricing/quote?symbol=${encodeURIComponent(normalized)}`,
  );
  return data?.price && Number.isFinite(data.price) && data.price > 0 ? data.price : null;
}

export function usePrices(assets: AssetForPricing[]) {
  const [prices, setPrices] = useState<Record<string, PriceResult>>({});
  const cacheRef = useRef<Record<string, { price: number | null; ts: number }>>({});
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
      const BATCH_SIZE = 3;

      try {
        for (let i = 0; i < assets.length; i += BATCH_SIZE) {
          const batch = assets.slice(i, i + BATCH_SIZE);

          const cryptoAssets = batch.filter((asset) => asset.assetType === 'CRYPTO');
          const cryptoPricesBySymbol = await fetchCryptoBatchPricesUsd(cryptoAssets.map((asset) => asset.symbol));

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

                if (price && !Number.isNaN(price)) {
                  newPrices[asset.id] = { price, source: 'market' };
                } else if (asset.purchasePrice) {
                  newPrices[asset.id] = { price: asset.purchasePrice, source: 'fallback' };
                  console.warn('[pricing:fallback-used]', { symbol: normalizedSymbol, assetType: asset.assetType });
                } else {
                  newPrices[asset.id] = { price: null, source: 'fallback' };
                  console.warn('[pricing:fallback-used]', { symbol: normalizedSymbol, assetType: asset.assetType });
                }

                console.log('[pricing]', { symbol: normalizedSymbol, type: asset.assetType, price });
              } catch {
                console.warn('[pricing:failed]', {
                  symbol: normalizeSymbol(asset.symbol),
                  assetType: asset.assetType,
                  provider: asset.assetType === 'CRYPTO' ? 'coingecko' : 'yahoo',
                });

                if (asset.purchasePrice) {
                  newPrices[asset.id] = { price: asset.purchasePrice, source: 'fallback' };
                } else {
                  newPrices[asset.id] = { price: null, source: 'fallback' };
                }

                console.warn('[pricing:fallback-used]', { symbol: normalizeSymbol(asset.symbol), assetType: asset.assetType });
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
    }, 30_000) as unknown as number;

    return () => {
      isMounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [JSON.stringify(assets.map((asset) => ({ id: asset.id, symbol: asset.symbol, assetType: asset.assetType })))]);

  return prices;
}
