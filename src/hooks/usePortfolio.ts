import { useEffect, useMemo } from 'react';
import { usePrices } from './usePrices';
import { useFX } from './useFX';

type AssetInput = {
  id: string;
  symbol: string;
  ticker?: string | null;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  currency: string;
  cedearRatio?: number | null;
};

export function usePortfolio(assets: AssetInput[]) {
  const prices = usePrices(assets);
  const { ccl } = useFX();

  useEffect(() => {
    if (ccl === null) console.warn('[fx:missing]');
  }, [ccl]);

  const positions = useMemo(() => assets.map((asset) => {
    const priceData = prices[asset.id];
    const marketPriceUsdRaw = priceData?.price ?? null;
    const isRealPrice = priceData?.source === 'market';

    let marketPriceUsd: number | null = marketPriceUsdRaw;
    let marketPriceArs: number | null = null;

    if (asset.assetType === 'CASH') {
      if (asset.currency === 'ARS') {
        marketPriceArs = 1;
        marketPriceUsd = ccl ? 1 / ccl : null;
      } else if (asset.currency === 'USD') {
        marketPriceUsd = 1;
        marketPriceArs = ccl ? ccl : null;
      }
    } else if (asset.assetType === 'CEDEAR') {
      const ratio = asset.cedearRatio && asset.cedearRatio > 0 ? asset.cedearRatio : 1;
      marketPriceArs = ccl && marketPriceUsd !== null ? (marketPriceUsd / ratio) * ccl : null;
    } else {
      marketPriceArs = ccl && marketPriceUsd !== null ? marketPriceUsd * ccl : null;
    }

    const marketValueUsd = marketPriceUsd !== null ? marketPriceUsd * asset.quantity : null;
    const marketValueArs = marketPriceArs !== null ? marketPriceArs * asset.quantity : null;

    const costBasisArs = asset.currency === 'ARS' ? asset.purchasePrice * asset.quantity : ccl ? asset.purchasePrice * asset.quantity * ccl : null;
    const costBasisUsd = asset.currency === 'USD' ? asset.purchasePrice * asset.quantity : ccl ? (asset.purchasePrice * asset.quantity) / ccl : null;

    const profitLossUsd = marketValueUsd !== null && costBasisUsd !== null ? marketValueUsd - costBasisUsd : null;
    const profitLossArs = marketValueArs !== null && costBasisArs !== null ? marketValueArs - costBasisArs : null;
    const roiPercent = costBasisUsd && profitLossUsd !== null && costBasisUsd > 0 ? (profitLossUsd / costBasisUsd) * 100 : 0;

    return {
      ...asset,
      ticker: asset.ticker || asset.symbol,
      marketPriceUsd,
      marketPriceArs,
      currentPrice: marketPriceArs,
      currentPriceUsd: marketPriceUsd,
      marketValueUsd,
      marketValueArs,
      marketValue: marketValueArs ?? 0,
      profitLossUsd,
      profitLossArs,
      profitLoss: profitLossArs ?? 0,
      costBasisUsd,
      costBasisArs,
      costBasis: costBasisArs ?? 0,
      roiPercent,
      isRealPrice,
      pnl: profitLossArs ?? 0,
      pnlPct: roiPercent,
    };
  }), [assets, ccl, prices]);

  const totals = useMemo(() => ({
    totalUsd: positions.reduce((sum, position) => sum + (position.marketValueUsd ?? 0), 0),
    totalArs: positions.reduce((sum, position) => sum + (position.marketValueArs ?? 0), 0),
  }), [positions]);

  return { positions, totals };
}
