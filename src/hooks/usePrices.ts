import { useEffect, useState } from 'react';

type AssetForPricing = {
  id: string;
  symbol: string;
  assetType: string;
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

  try {
    if (coingeckoCandidateIds.length > 0) {
      const ids = encodeURIComponent(coingeckoCandidateIds.join(','));
      const coingeckoRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (coingeckoRes.ok) {
        const coingeckoData = await coingeckoRes.json() as Record<string, { usd?: number }>;
        for (const id of coingeckoCandidateIds) {
          const price = Number(coingeckoData?.[id]?.usd ?? null);
          if (Number.isFinite(price) && price > 0) return price;
        }
      }
    }
  } catch (error) {
    console.error('CoinGecko error:', baseSymbol, error);
  }

  try {
    const normalized = normalizeCryptoSymbol(symbol);
    const binanceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(normalized)}`);
    if (!binanceRes.ok) return null;
    const binanceData = await binanceRes.json() as { price?: string };
    const binancePrice = Number(binanceData?.price ?? null);
    if (!Number.isFinite(binancePrice) || binancePrice <= 0) return null;
    return binancePrice;
  } catch (error) {
    console.error('Binance fallback error:', symbol, error);
    return null;
  }
}

async function fetchStockPriceUsd(symbol: string): Promise<number | null> {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return null;

  try {
    const twelveDataRes = await fetch(`https://api.twelvedata.com/price?symbol=${encodeURIComponent(normalized)}&apikey=demo`);
    if (twelveDataRes.ok) {
      const twelveData = await twelveDataRes.json() as { price?: string; status?: string };
      if (twelveData.status !== 'error') {
        const price = Number(twelveData.price ?? null);
        if (Number.isFinite(price) && price > 0) return price;
      }
    }
  } catch (error) {
    console.error('TwelveData error:', normalized, error);
  }

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
    console.error('Yahoo chart fallback error:', normalized, error);
    return null;
  }
}

export function usePrices(assets: AssetForPricing[]) {
  const [prices, setPrices] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!assets || assets.length === 0) {
      setPrices({});
      return;
    }

    let isMounted = true;
    let intervalId: number | null = null;

    const fetchPrices = async () => {
      const newPrices: Record<string, number | null> = {};

      await Promise.all(
        assets.map(async (asset) => {
          try {
            let price: number | null = null;

            if (asset.assetType === 'CRYPTO') {
              price = await fetchCryptoPriceUsd(asset.symbol);
            }

            if (asset.assetType === 'STOCK' || asset.assetType === 'CEDEAR') {
              price = await fetchStockPriceUsd(asset.symbol);
            }

            newPrices[asset.id] = price ?? null;
            console.log('[pricing]', { symbol: asset.symbol, type: asset.assetType, price });
          } catch (error) {
            console.error('Price fetch error:', asset.symbol, error);
            newPrices[asset.id] = null;
          }
        }),
      );

      if (isMounted) setPrices(newPrices);
    };

    fetchPrices().catch(() => undefined);
    intervalId = window.setInterval(() => {
      fetchPrices().catch(() => undefined);
    }, 10_000) as unknown as number;

    return () => {
      isMounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [JSON.stringify(assets.map((asset) => ({ id: asset.id, symbol: asset.symbol, assetType: asset.assetType })))]);

  return prices;
}
