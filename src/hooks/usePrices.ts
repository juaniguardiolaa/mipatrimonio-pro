import { useEffect, useRef, useState } from 'react';

type AssetForPricing = {
  id: string;
  symbol: string;
  assetType: string;
  purchasePrice?: number;
};

export type PriceResult = {
  price: number;
  source: 'market' | 'fallback';
};

function normalizeCryptoSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  return upper.endsWith('USDT') ? upper : `${upper}USDT`;
}

function normalizeCryptoBaseSymbol(symbol: string) {
  return normalizeCryptoSymbol(symbol).replace(/USDT$/, '').toLowerCase();
}

async function fetchCryptoPriceUsd(symbol: string): Promise<number | null> {
  const baseSymbol = normalizeCryptoBaseSymbol(symbol);

  const explicitIdMap: Record<string, string> = {
    btc: 'bitcoin',
    eth: 'ethereum',
    sol: 'solana',
    bnb: 'binancecoin',
    xrp: 'ripple',
    ada: 'cardano',
    doge: 'dogecoin',
    matic: 'matic-network',
    avax: 'avalanche-2',
    dot: 'polkadot',
    link: 'chainlink',
    ltc: 'litecoin',
  };

  const coingeckoCandidateIds = Array.from(new Set([
    explicitIdMap[baseSymbol],
    baseSymbol,
    baseSymbol.replace(/_/g, '-'),
  ].filter(Boolean) as string[]));

  if (coingeckoCandidateIds.length === 0) return null;

  try {
    const ids = encodeURIComponent(coingeckoCandidateIds.join(','));
    const coingeckoRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    if (!coingeckoRes.ok) return null;
    const coingeckoData = await coingeckoRes.json() as Record<string, { usd?: number }>;
    for (const id of coingeckoCandidateIds) {
      const price = Number(coingeckoData?.[id]?.usd ?? null);
      if (Number.isFinite(price) && price > 0) return price;
    }
    return null;
  } catch (error) {
    console.warn('[pricing:failed]', { symbol, assetType: 'CRYPTO', reason: error instanceof Error ? error.message : 'coingecko_error' });
    return null;
  }
}

async function fetchStockPriceUsd(symbol: string): Promise<number | null> {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return null;

  try {
    const chartRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}`);
    if (!chartRes.ok) return null;
    const chartData = await chartRes.json() as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
        }>;
      };
    };
    const price = Number(chartData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null);
    if (!Number.isFinite(price) || price <= 0) return null;
    return price;
  } catch (error) {
    console.warn('[pricing:failed]', { symbol: normalized, assetType: 'STOCK', reason: error instanceof Error ? error.message : 'yahoo_error' });
    return null;
  }
}

export function usePrices(assets: AssetForPricing[]) {
  const [prices, setPrices] = useState<Record<string, PriceResult>>({});
  const cacheRef = useRef<Record<string, { price: number | null; ts: number }>>({});

  useEffect(() => {
    if (!assets || assets.length === 0) {
      setPrices({});
      return;
    }

    let isMounted = true;
    let intervalId: number | null = null;

    const fetchPrices = async () => {
      const newPrices: Record<string, PriceResult> = {};
      const now = Date.now();
      const BATCH_SIZE = 3;

      for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (asset) => {
          try {
            let price: number | null = null;
            const cacheKey = `${asset.assetType}:${asset.symbol.toUpperCase()}`;
            const cached = cacheRef.current[cacheKey];

            if (cached && now - cached.ts < 60_000) {
              price = cached.price;
            } else {
              if (asset.assetType === 'CRYPTO') {
                price = await fetchCryptoPriceUsd(asset.symbol);
              }

              if (asset.assetType === 'STOCK' || asset.assetType === 'CEDEAR') {
                price = await fetchStockPriceUsd(asset.symbol);
              }

              if (asset.assetType === 'CEDEAR') {
                // future: apply FX * ratio
              }

              cacheRef.current[cacheKey] = { price, ts: Date.now() };
            }

            if (price === null) {
              console.warn('[pricing:failed]', {
                symbol: asset.symbol,
                assetType: asset.assetType,
                reason: 'provider_unavailable',
              });
            }

            if (price && !Number.isNaN(price)) {
              newPrices[asset.id] = { price, source: 'market' };
            } else if (asset.purchasePrice) {
              newPrices[asset.id] = { price: asset.purchasePrice, source: 'fallback' };
              console.warn('[pricing:fallback-used]', { symbol: asset.symbol, assetType: asset.assetType });
            } else {
              newPrices[asset.id] = { price: 0, source: 'fallback' };
              console.warn('[pricing:fallback-used]', { symbol: asset.symbol, assetType: asset.assetType });
            }
            console.log('[pricing]', { symbol: asset.symbol, type: asset.assetType, price });
          } catch (error) {
            console.warn('[pricing:failed]', {
              symbol: asset.symbol,
              assetType: asset.assetType,
              reason: error instanceof Error ? error.message : 'unknown_error',
            });
            if (asset.purchasePrice) {
              newPrices[asset.id] = { price: asset.purchasePrice, source: 'fallback' };
            } else {
              newPrices[asset.id] = { price: 0, source: 'fallback' };
            }
            console.warn('[pricing:fallback-used]', { symbol: asset.symbol, assetType: asset.assetType });
          }
        }));
      }

      if (isMounted) setPrices(newPrices);
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
