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

async function fetchCryptoPriceUsd(symbol: string): Promise<number | null> {
  const normalized = normalizeCryptoSymbol(symbol);

  try {
    const binanceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(normalized)}`);
    if (binanceRes.ok) {
      const binanceData = await binanceRes.json() as { price?: string };
      const binancePrice = parseFloat(binanceData?.price ?? 'NaN');
      if (Number.isFinite(binancePrice) && binancePrice > 0) return binancePrice;
    }
  } catch (error) {
    console.error('Price fetch error:', normalized, error);
  }

  try {
    const idMap: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      SOL: 'solana',
      BNB: 'binancecoin',
      XRP: 'ripple',
      ADA: 'cardano',
      DOGE: 'dogecoin',
    };
    const base = normalized.replace(/USDT$/, '');
    const id = idMap[base];
    if (!id) return null;
    const coingeckoRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`);
    if (!coingeckoRes.ok) return null;
    const coingeckoData = await coingeckoRes.json() as Record<string, { usd?: number }>;
    const coingeckoPrice = Number(coingeckoData?.[id]?.usd ?? null);
    if (!Number.isFinite(coingeckoPrice) || coingeckoPrice <= 0) return null;
    return coingeckoPrice;
  } catch (error) {
    console.error('CoinGecko fallback error:', normalized, error);
    return null;
  }
}

export function usePrices(assets: AssetForPricing[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!assets || assets.length === 0) {
      setPrices({});
      return;
    }

    let isMounted = true;
    let intervalId: number | null = null;

    const fetchPrices = async () => {
      const newPrices: Record<string, number> = {};

      await Promise.all(
        assets.map(async (asset) => {
          try {
            let price: number | null = null;

            if (asset.assetType === 'CRYPTO') {
              price = await fetchCryptoPriceUsd(asset.symbol);
            }

            if (asset.assetType === 'STOCK' || asset.assetType === 'CEDEAR') {
              price = null;
            }

            if (price && !Number.isNaN(price)) {
              newPrices[asset.id] = price;
            }
          } catch (error) {
            console.error('Price fetch error:', asset.symbol, error);
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
