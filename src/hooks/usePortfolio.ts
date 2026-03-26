import { useMemo } from 'react';
import { usePrices } from './usePrices';

type AssetInput = {
  id: string;
  symbol: string;
  ticker?: string | null;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  currency: string;
};

export function usePortfolio(assets: AssetInput[]) {
  const prices = usePrices(assets);

  return useMemo(() => assets.map((asset) => {
    const priceData = prices[asset.id];
    const marketPriceUsd = priceData?.price ?? 0;
    const isRealPrice = priceData?.source === 'market';
    const marketValueUsd = marketPriceUsd * asset.quantity;
    const marketPrice = marketPriceUsd;
    const marketValue = marketValueUsd;
    const costBasis = asset.purchasePrice * asset.quantity;
    const profitLoss = marketValue - costBasis;
    const roiPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

    return {
      ...asset,
      ticker: asset.ticker || asset.symbol,
      currentPrice: marketPrice,
      currentPriceUsd: marketPriceUsd,
      marketPrice,
      marketPriceUsd,
      costBasis,
      marketValue,
      marketValueUsd,
      profitLoss,
      roiPercent,
      isRealPrice,
      pnl: profitLoss,
      pnlPct: roiPercent,
    };
  }), [assets, prices]);
}
