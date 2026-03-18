import { Asset, PriceSnapshot } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCryptoPrice } from '@/lib/providers/binance';
import { getStockPrice } from '@/lib/providers/yahoo';
import { getFxRate, refreshFxRates } from '@/lib/pricing/fx.service';
import { valuateAsset } from './valuation.service';

type SupportedSource = 'BINANCE' | 'YAHOO_FINANCE';

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
  return assetType.toUpperCase() === 'CRYPTO' ? 'BINANCE' : 'YAHOO_FINANCE';
}

async function getCachedSnapshot(symbol: string): Promise<PriceSnapshot | null> {
  const thirtySecondsAgo = new Date(Date.now() - 30_000);
  return prisma.priceSnapshot.findFirst({
    where: { symbol: symbol.toUpperCase(), timestamp: { gte: thirtySecondsAgo } },
    orderBy: { timestamp: 'desc' },
  });
}

export async function getCurrentPrice(symbol: string, assetType = 'STOCK'): Promise<CurrentPrice | null> {
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
  if (source === 'BINANCE') {
    const cryptoQuote = await getCryptoPrice(symbol);
    if (!cryptoQuote) return null;

    return {
      symbol: cryptoQuote.symbol,
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
    source,
    timestamp: equityQuote.timestamp,
  };
}

export async function updateAssetMarketValue(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return null;

  console.log('Processing asset:', {
    symbol: asset.symbol,
    type: asset.assetType,
    exchange: asset.exchange,
  });

  const valuation = await valuateAsset(asset);
  if (!valuation) {
    throw new Error(`No valuation available for ${asset.symbol}`);
  }

  await prisma.priceSnapshot.create({
    data: {
      symbol: asset.symbol.toUpperCase(),
      price: valuation.marketPriceUsd,
      currency: 'USD',
      source: valuation.source,
      timestamp: valuation.timestamp,
    },
  });

  return prisma.asset.update({
    where: { id: asset.id },
    data: {
      marketPriceUsd: valuation.marketPriceUsd,
      marketPrice: valuation.marketPrice,
      marketValue: valuation.marketValue,
      marketValueUsd: valuation.marketValueUsd,
      lastPriceUpdate: new Date(),
    },
  });
}

export async function recalculatePortfolioValue(portfolioId: string) {
  const assets = await prisma.asset.findMany({ where: { portfolioId } });

  const totals = assets.reduce(
    (acc, asset) => {
      const marketValue = asset.marketValue || 0;
      const marketValueUsd = asset.marketValueUsd || 0;
      const costBasis = asset.quantity * asset.purchasePrice;
      acc.marketValue += marketValue;
      acc.marketValueUsd += marketValueUsd;
      acc.costBasis += costBasis;
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

export async function recalculateUserNetWorth(userId: string) {
  const portfolios = await prisma.portfolio.findMany({ where: { userId } });
  const netWorthArs = portfolios.reduce((sum, item) => sum + item.netWorth, 0);
  const netWorthUsd = portfolios.reduce((sum, item) => sum + (item.netWorthUsd || 0), 0);

  await prisma.netWorthHistory.create({
    data: {
      userId,
      netWorthArs,
      netWorthUsd,
      timestamp: new Date(),
    },
  });

  return { netWorthArs, netWorthUsd };
}

export async function getNetWorthARS(userId: string) {
  const totals = await recalculateUserNetWorth(userId);
  return totals.netWorthArs;
}

export async function getNetWorthUSD(userId: string) {
  const totals = await recalculateUserNetWorth(userId);
  if (totals.netWorthUsd > 0) return totals.netWorthUsd;

  const ccl = await getFxRate('USD_ARS_CCL');
  if (!ccl || ccl <= 0) return 0;
  return totals.netWorthArs / ccl;
}

export function computePositionMetrics(asset: Pick<Asset, 'quantity' | 'purchasePrice' | 'marketPrice' | 'marketPriceUsd'>) {
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
  console.log('Pricing update started');

  let fxUpdated = false;
  try {
    const fxRates = await refreshFxRates();
    fxUpdated = fxRates.length > 0;
    console.log('FX updated');
  } catch (error) {
    console.error('pricing provider failed', error);
  }

  const assets = await prisma.asset.findMany({
    select: { id: true, symbol: true, assetType: true, portfolioId: true },
  });

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
        console.error('pricing provider failed', error);
      }
    }
    group.portfolioIds.forEach((portfolioId) => updatedPortfolios.add(portfolioId));
  }
  console.log(`Assets updated: ${assetsUpdated}`);

  let portfoliosUpdated = 0;
  for (const portfolioId of updatedPortfolios) {
    try {
      await recalculatePortfolioValue(portfolioId);
      portfoliosUpdated += 1;
    } catch (error) {
      console.error('pricing provider failed', error);
    }
  }
  console.log(`Portfolios updated: ${portfoliosUpdated}`);

  const executionTimeMs = Date.now() - start;
  console.log(`Execution time: ${executionTimeMs}ms`);

  return {
    success: true,
    assetsUpdated,
    portfoliosUpdated,
    fxUpdated,
    executionTimeMs,
  };
}
