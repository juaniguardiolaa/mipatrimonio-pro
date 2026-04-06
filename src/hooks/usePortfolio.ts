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
 
function roundMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}
 
const safeSum = (values: Array<number | null>) =>
  values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
 
export function isValidAsset(position: {
  marketValueUsd: number | null;
  isRealPrice: boolean;
}) {
  return position.marketValueUsd !== null && position.isRealPrice;
}
 
export function usePortfolio(assets: AssetInput[]) {
  const prices = usePrices(assets);
  const { ccl } = useFX();
 
  useEffect(() => {
    if (ccl === null) console.warn('[fx:missing] CCL not available — ARS values will be null');
  }, [ccl]);
 
  const positions = useMemo(
    () =>
      assets.map((asset) => {
        const priceData = prices[asset.id];
        const rawPriceUsd = priceData?.price ?? null;
        const isRealPrice = priceData?.source === 'market';
 
        // ─── Market prices ────────────────────────────────────────────────
        let marketPriceUsd: number | null = null;
        let marketPriceArs: number | null = null;
 
        if (asset.assetType === 'CASH') {
          if (asset.currency === 'ARS') {
            // 1 ARS = 1 ARS; USD equivalent needs CCL
            marketPriceArs = 1;
            marketPriceUsd = ccl && ccl > 0 ? 1 / ccl : null;
          } else {
            // USD cash
            marketPriceUsd = 1;
            marketPriceArs = ccl ?? null;
          }
        } else if (asset.assetType === 'CEDEAR') {
          // CEDEAR formula: priceArs = (underlyingUsdPrice / ratio) * CCL
          // rawPriceUsd here is the underlying stock price in USD (from Yahoo)
          const ratio =
            asset.cedearRatio && asset.cedearRatio > 0 ? asset.cedearRatio : null;
 
          if (!ratio) {
            console.warn('[cedear:missing-ratio]', { symbol: asset.symbol });
          }
 
          if (rawPriceUsd && ratio && ccl && isRealPrice) {
            marketPriceUsd = rawPriceUsd / ratio; // USD per CEDEAR
            marketPriceArs = marketPriceUsd * ccl; // ARS per CEDEAR
          } else {
            // Can't price without all three inputs
            marketPriceUsd = null;
            marketPriceArs = null;
            if (!rawPriceUsd)
              console.warn('[cedear:missing-data] no underlying price', { symbol: asset.symbol });
            if (!ccl)
              console.warn('[cedear:missing-data] no CCL rate', { symbol: asset.symbol });
          }
        } else {
          // STOCK, ETF, BOND, CRYPTO — priced in USD, convert to ARS via CCL
          marketPriceUsd = isRealPrice ? rawPriceUsd : null;
          marketPriceArs = marketPriceUsd !== null && ccl ? marketPriceUsd * ccl : null;
        }
 
        // ─── Market values ────────────────────────────────────────────────
        const marketValueUsd =
          marketPriceUsd !== null ? marketPriceUsd * asset.quantity : null;
        const marketValueArs =
          marketPriceArs !== null ? marketPriceArs * asset.quantity : null;
 
        // ─── Cost basis ───────────────────────────────────────────────────
        //
        // CEDEAR:  purchasePrice is stored in ARS/CEDEAR (user entered ARS price)
        // CASH:    purchasePrice is 1 (nominal), cost basis = quantity in that currency
        // Others:  purchasePrice currency follows asset.currency field
        //
        let costBasisUsd: number | null = null;
        let costBasisArs: number | null = null;
 
        if (asset.assetType === 'CEDEAR') {
          // purchasePrice is in ARS per CEDEAR
          costBasisArs = asset.purchasePrice * asset.quantity;
          costBasisUsd = ccl && ccl > 0 ? costBasisArs / ccl : null;
        } else if (asset.assetType === 'CASH') {
          if (asset.currency === 'ARS') {
            costBasisArs = asset.quantity;
            costBasisUsd = ccl && ccl > 0 ? costBasisArs / ccl : null;
          } else {
            costBasisUsd = asset.quantity;
            costBasisArs = ccl ? costBasisUsd * ccl : null;
          }
        } else if (asset.currency === 'USD') {
          costBasisUsd = asset.purchasePrice * asset.quantity;
          costBasisArs = ccl ? costBasisUsd * ccl : null;
        } else {
          // ARS-denominated non-CEDEAR asset (e.g. domestic bond in ARS)
          costBasisArs = asset.purchasePrice * asset.quantity;
          costBasisUsd = ccl && ccl > 0 ? costBasisArs / ccl : null;
        }
 
        // ─── PnL ──────────────────────────────────────────────────────────
        const profitLossUsd =
          marketValueUsd !== null && costBasisUsd !== null
            ? marketValueUsd - costBasisUsd
            : null;
        const profitLossArs =
          marketValueArs !== null && costBasisArs !== null
            ? marketValueArs - costBasisArs
            : null;
 
        // ROI is always computed in USD to avoid CCL noise; fall back to ARS ratio
        const roiPercent =
          costBasisUsd && costBasisUsd > 0 && profitLossUsd !== null
            ? (profitLossUsd / costBasisUsd) * 100
            : costBasisArs && costBasisArs > 0 && profitLossArs !== null
              ? (profitLossArs / costBasisArs) * 100
              : 0;
 
        return {
          ...asset,
          ticker: asset.ticker || asset.symbol,
          // Expose both naming conventions used across the app
          marketPriceUsd: roundMoney(marketPriceUsd),
          marketPriceArs: roundMoney(marketPriceArs),
          currentPrice: roundMoney(marketPriceArs),
          currentPriceUsd: roundMoney(marketPriceUsd),
          marketValueUsd: roundMoney(marketValueUsd),
          marketValueArs: roundMoney(marketValueArs),
          marketValue: roundMoney(marketValueArs) ?? 0,
          profitLossUsd: roundMoney(profitLossUsd),
          profitLossArs: roundMoney(profitLossArs),
          profitLoss: roundMoney(profitLossArs) ?? 0,
          costBasisUsd: roundMoney(costBasisUsd),
          costBasisArs: roundMoney(costBasisArs),
          costBasis: roundMoney(costBasisArs) ?? 0,
          roiPercent,
          isRealPrice,
          pnl: roundMoney(profitLossArs) ?? 0,
          pnlPct: roiPercent,
        };
      }),
    [assets, ccl, prices],
  );
 
  const totals = useMemo(() => {
    const validPositions = positions.filter((p) => isValidAsset(p));
    return {
      totalUsd: roundMoney(safeSum(validPositions.map((p) => p.marketValueUsd))) ?? 0,
      totalArs: roundMoney(safeSum(validPositions.map((p) => p.marketValueArs))) ?? 0,
    };
  }, [positions]);
 
  return { positions, totals };
}
 
