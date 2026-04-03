import { Asset, PriceSnapshot } from '@prisma/client';
import { prisma } from '@/lib/db';
// ── FIX: import from the single canonical CoinGecko provider ─────────────────
import { getCryptoPrice, normalizeCryptoSymbol } from '@/lib/providers/coingecko';
import { getStockPrice } from '@/lib/providers/yahoo';
import { getFxRate, refreshFxRates } from '@/lib/pricing/fx.service';
import { valuateAsset } from './valuation.service';
 
type SupportedSource = 'COINGECKO' | 'YAHOO_FINANCE' | 'STOCK_FALLBACK';
 
type CurrentPrice = {
  symbol: string;
  price: number;
  currency: string;
  source: SupportedSource;
  timestamp: Date;
};
 
export type PricingExecutionResult = {
  success: true;
  assetsUpdated: number;
  portfoliosUpdated: number;
  fxUpdated: boolean;
  executionTimeMs: number;
};
 
function resolveSource(assetType: string): SupportedSource {
  return assetType.toUpperCase() === 'CRYPTO' ? 'COINGECKO' : 'YAHOO_FINANCE';
}
 
async function getCachedSnapshot(symbol: string): Promise<PriceSnapshot | null> {
  const thirtySecondsAgo = new Date(Date.now() - 30_000);
  return prisma.priceSnapshot.findFirst({
    where: { symbol: symbol.toUpperCase(), timestamp: { gte: thirtySecondsAgo } },
    orderBy: { timestamp: 'desc' },
  });
}
 
export async function getCurrentPrice(
  symbol: string,
  assetType = 'STOCK',
): Promise<CurrentPrice | null> {
  const cached = await getCachedSnapshot(symbol);
  if (cached) {
    return {
      symbol: cached.symbol,
      price: cached.price,
      currency: cached.currency,
      source: cached.source as SupportedSource,
      timestamp: cached.timestamp,
    };
  }
 
  const source = resolveSource(assetType);
 
  if (source === 'COINGECKO') {
    const cryptoQuote = await getCryptoPrice(symbol);
    if (!cryptoQuote) return null;
    return {
      symbol: normalizeCryptoSymbol(cryptoQuote.symbol),
      price: cryptoQuote.priceUsd,
      currency: 'USD',
      source,
      timestamp: cryptoQuote.timestamp,
    };
  }
 
  const equityQuote = await getStockPrice(symbol);
  if (!equityQuote) return null;
  return {
    symbol: equityQuote.symbol,
    price: equityQuote.priceUsd,
    currency: equityQuote.currency,
    source: 'YAHOO_FINANCE',
    timestamp: equityQuote.timestamp,
  };
}
 
export async function updateAssetMarketValue(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return null;
 
  console.log('[pricing] updating_asset', { symbol: asset.symbol, type: asset.assetType });
 
  const valuation = await valuateAsset(asset);
 
  if (!valuation.success && valuation.marketPriceUsd === null) {
    console.warn('[pricing] no_valuation', {
      assetId: asset.id,
      symbol: asset.symbol,
      reason: valuation.reason,
    });
    return prisma.asset.update({
      where: { id: asset.id },
      data: {
        marketPriceUsd: asset.marketPriceUsd,
        marketPrice: asset.marketPrice,
        marketValue: valuation.marketValue,
        marketValueUsd: valuation.marketValueUsd,
        lastPriceUpdate: valuation.timestamp,
      },
    });
  }
 
  if (valuation.marketPriceUsd !== null) {
    await prisma.priceSnapshot.create({
      data: {
        symbol: asset.symbol.toUpperCase(),
        price: valuation.marketPriceUsd,
        currency: 'USD',
        source: valuation.source,
        timestamp: valuation.timestamp,
      },
    });
  }
 
  return prisma.asset.update({
    where: { id: asset.id },
    data: {
      marketPriceUsd: valuation.marketPriceUsd ?? asset.marketPriceUsd,
      marketPrice: valuation.marketPrice ?? asset.marketPrice,
      marketValue: valuation.marketValue,
      marketValueUsd: valuation.marketValueUsd,
      lastPriceUpdate: valuation.timestamp,
    },
  });
}
 
export async function recalculatePortfolioValue(portfolioId: string) {
  const assets = await prisma.asset.findMany({ where: { portfolioId } });
 
  const totals = assets.reduce(
    (acc, asset) => {
      acc.marketValue += asset.marketValue || 0;
      acc.marketValueUsd += asset.marketValueUsd || 0;
      acc.costBasis += asset.quantity * asset.purchasePrice;
      return acc;
    },
    { marketValue: 0, marketValueUsd: 0, costBasis: 0 },
  );
 
  return prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      totalMarketValue: totals.marketValue,
      totalCostBasis: totals.costBasis,
      netWorth: totals.marketValue,
      netWorthUsd: totals.marketValueUsd,
    },
  });
}
 
/**
 * ── FIX: Only write a NetWorthHistory row when the value has meaningfully
 * changed (>0.5% delta vs the last recorded entry), preventing thousands
 * of duplicate rows from dashboard reloads.
 */
export async function recalculateUserNetWorth(userId: string) {
  const portfolios = await prisma.portfolio.findMany({ where: { userId } });
  const netWorthArs = portfolios.reduce((sum, p) => sum + p.netWorth, 0);
  const netWorthUsd = portfolios.reduce((sum, p) => sum + (p.netWorthUsd || 0), 0);
 
  const lastEntry = await prisma.netWorthHistory.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' },
  });
 
  const DELTA_THRESHOLD = 0.005; // 0.5%
  const lastUsd = lastEntry?.netWorthUsd ?? 0;
  const delta =
    lastUsd > 0 ? Math.abs(netWorthUsd - lastUsd) / lastUsd : 1;
 
  if (!lastEntry || delta > DELTA_THRESHOLD) {
    await prisma.netWorthHistory.create({
      data: { userId, netWorthArs, netWorthUsd, timestamp: new Date() },
    });
    console.log('[pricing] networth_history_written', { userId, netWorthUsd, delta });
  } else {
    console.log('[pricing] networth_history_skipped', {
      userId,
      delta,
      threshold: DELTA_THRESHOLD,
    });
  }
 
  return { netWorthArs, netWorthUsd };
}
 
export async function getNetWorthARS(userId: string) {
  return (await recalculateUserNetWorth(userId)).netWorthArs;
}
 
export async function getNetWorthUSD(userId: string) {
  const totals = await recalculateUserNetWorth(userId);
  if (totals.netWorthUsd > 0) return totals.netWorthUsd;
  const ccl = await getFxRate('USD_ARS_CCL');
  if (!ccl || ccl <= 0) return 0;
  return totals.netWorthArs / ccl;
}
 
export function computePositionMetrics(
  asset: Pick<Asset, 'quantity' | 'purchasePrice' | 'marketPrice' | 'marketPriceUsd'>,
) {
  const currentPrice = asset.marketPrice || 0;
  const currentPriceUsd = asset.marketPriceUsd || 0;
  const costBasis = asset.quantity * asset.purchasePrice;
  const marketValue = asset.quantity * currentPrice;
  const marketValueUsd = asset.quantity * currentPriceUsd;
  const profitLoss = marketValue - costBasis;
  const roiPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
  return { costBasis, marketValue, marketValueUsd, profitLoss, roiPercent, currentPrice, currentPriceUsd };
}
 
export async function executePricingUpdate(): Promise<PricingExecutionResult> {
  const start = Date.now();
  console.log('[pricing] update_started');
 
  let fxUpdated = false;
  try {
    const fxRates = await refreshFxRates();
    fxUpdated = fxRates.length > 0;
    console.log('[pricing] fx_updated', { count: fxRates.length });
  } catch (error) {
    console.error('[pricing] fx_update_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
 
  const assets = await prisma.asset.findMany({
    select: { id: true, symbol: true, assetType: true, portfolioId: true },
  });
 
  // De-duplicate by symbol+type so identical symbols don't generate N API calls
  const grouped = new Map<string, { assetIds: string[]; portfolioIds: Set<string> }>();
  for (const asset of assets) {
    const key = `${asset.symbol.toUpperCase()}-${asset.assetType.toUpperCase()}`;
    const found = grouped.get(key);
    if (found) {
      found.assetIds.push(asset.id);
      found.portfolioIds.add(asset.portfolioId);
    } else {
      grouped.set(key, { assetIds: [asset.id], portfolioIds: new Set([asset.portfolioId]) });
    }
  }
 
  const updatedPortfolios = new Set<string>();
  let assetsUpdated = 0;
 
  for (const group of grouped.values()) {
    for (const assetId of group.assetIds) {
      try {
        const updated = await updateAssetMarketValue(assetId);
        if (updated) assetsUpdated += 1;
      } catch (error) {
        console.error('[pricing] asset_update_failed', {
          assetId,
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
    group.portfolioIds.forEach((id) => updatedPortfolios.add(id));
  }
 
  let portfoliosUpdated = 0;
  for (const portfolioId of updatedPortfolios) {
    try {
      await recalculatePortfolioValue(portfolioId);
      portfoliosUpdated += 1;
    } catch (error) {
      console.error('[pricing] portfolio_recalc_failed', {
        portfolioId,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
 
  const executionTimeMs = Date.now() - start;
  console.log('[pricing] update_finished', { assetsUpdated, portfoliosUpdated, executionTimeMs });
 
  return { success: true, assetsUpdated, portfoliosUpdated, fxUpdated, executionTimeMs };
}
