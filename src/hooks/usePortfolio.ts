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
  purchaseCcl?: number | null;
  cedearRatio?: number | null;
};

function roundMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

const safeSum = (values: Array<number | null>) => values.reduce<number>((acc, v) => acc + (v ?? 0), 0);

export function isValidAsset(position: { marketValueUsd: number | null; isRealPrice: boolean }) {
  return position.marketValueUsd !== null && position.isRealPrice;
}

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
    const effectivePriceUsd = isRealPrice ? marketPriceUsdRaw : null;

    let marketPriceUsd: number | null = marketPriceUsdRaw;
    let marketPriceArs: number | null = null;
    let effectivePriceArs: number | null = null;

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
      if (!effectivePriceUsd || !ccl) {
        console.warn('[cedear:missing-data]', { symbol: asset.symbol });
        marketPriceArs = null;
      } else {
        marketPriceArs = (effectivePriceUsd / ratio) * ccl;
      }
    } else {
      marketPriceArs = ccl && marketPriceUsd !== null ? marketPriceUsd * ccl : null;
    }

    effectivePriceArs = ccl && effectivePriceUsd !== null ? effectivePriceUsd * ccl : null;
    const pnlEligiblePriceUsd = asset.assetType === 'CASH' ? marketPriceUsd : effectivePriceUsd;
    const pnlEligiblePriceArs = asset.assetType === 'CEDEAR'
      ? marketPriceArs
      : asset.assetType === 'CASH'
        ? marketPriceArs
        : effectivePriceArs;

    const marketValueUsd = pnlEligiblePriceUsd !== null ? pnlEligiblePriceUsd * asset.quantity : null;
    const marketValueArs = asset.assetType === 'CEDEAR'
      ? marketPriceArs !== null ? marketPriceArs * asset.quantity : null
      : pnlEligiblePriceArs !== null ? pnlEligiblePriceArs * asset.quantity : null;

    // Base currency: USD (all calculations start in USD)
    const costBasisArsRaw = asset.purchasePrice * asset.quantity;
    const basisCcl = asset.purchaseCcl && asset.purchaseCcl > 0 ? asset.purchaseCcl : ccl;
    const costBasisUsd = asset.currency === 'USD'
      ? asset.purchasePrice * asset.quantity
      : basisCcl && basisCcl > 0
        ? costBasisArsRaw / basisCcl
        : null;
    const costBasisArs = costBasisUsd !== null && ccl ? costBasisUsd * ccl : null;

    const profitLossUsd = marketValueUsd !== null && costBasisUsd !== null ? marketValueUsd - costBasisUsd : null;
    const profitLossArs = profitLossUsd !== null && ccl ? profitLossUsd * ccl : null;
    const roiPercent: number | null = costBasisUsd && costBasisUsd > 0 && profitLossUsd !== null
      ? (profitLossUsd / costBasisUsd) * 100
      : costBasisArs && costBasisArs > 0 && profitLossArs !== null
        ? (profitLossArs / costBasisArs) * 100
        : null;

    return {
      ...asset,
      ticker: asset.ticker || asset.symbol,
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
      pnlPct: roiPercent ?? 0,
    };
  }), [assets, ccl, prices]);

  const totals = useMemo(() => {
    const validPositions = positions.filter((position) => isValidAsset(position));
    return {
      totalUsd: roundMoney(safeSum(validPositions.map((position) => position.marketValueUsd))) ?? 0,
      totalArs: roundMoney(safeSum(validPositions.map((position) => position.marketValueArs))) ?? 0,
    };
  }, [positions]);

  return { positions, totals };
}
