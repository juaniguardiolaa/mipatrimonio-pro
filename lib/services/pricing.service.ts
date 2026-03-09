import { Asset, PriceSnapshot } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getBinancePrice } from '@/lib/integrations/binance-price.service';
import { getIolPrice } from '@/lib/integrations/iol-price.service';

type SupportedSource = 'BINANCE' | 'IOL';

type CurrentPrice = {
  symbol: string;
  price: number;
  currency: string;
  source: SupportedSource;
  timestamp: Date;
};

function resolveSource(assetType: string): SupportedSource {
  return assetType.toUpperCase() === 'CRYPTO' ? 'BINANCE' : 'IOL';
}

async function getCachedSnapshot(symbol: string): Promise<PriceSnapshot | null> {
  const sixtySecondsAgo = new Date(Date.now() - 60_000);
  return prisma.priceSnapshot.findFirst({
    where: { symbol: symbol.toUpperCase(), timestamp: { gte: sixtySecondsAgo } },
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
  let quote: CurrentPrice | null = null;

  if (source === 'BINANCE') {
    const cryptoQuote = await getBinancePrice(symbol);
    if (cryptoQuote) {
      quote = { symbol: cryptoQuote.symbol, price: cryptoQuote.price, currency: 'USDT', source, timestamp: cryptoQuote.timestamp };
    }
  } else {
    const equityQuote = await getIolPrice(symbol);
    if (equityQuote) {
      quote = { symbol: equityQuote.ticker, price: equityQuote.price, currency: equityQuote.currency, source, timestamp: equityQuote.timestamp };
    }
  }

  if (!quote) return null;

  await prisma.priceSnapshot.create({
    data: {
      symbol: quote.symbol,
      price: quote.price,
      currency: quote.currency,
      source: quote.source,
      timestamp: quote.timestamp,
    },
  });

  return quote;
}

export async function updateAssetMarketValue(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return null;

  const price = await getCurrentPrice(asset.symbol, asset.assetType);
  if (!price) return null;

  const marketValue = asset.quantity * price.price;

  return prisma.asset.update({
    where: { id: asset.id },
    data: {
      marketPrice: price.price,
      marketValue,
      lastPriceUpdate: price.timestamp,
    },
  });
}

export async function recalculatePortfolioValue(portfolioId: string) {
  const assets = await prisma.asset.findMany({ where: { portfolioId } });

  const totals = assets.reduce(
    (acc, asset) => {
      const marketValue = asset.marketValue || 0;
      const costBasis = asset.quantity * asset.purchasePrice;
      acc.marketValue += marketValue;
      acc.costBasis += costBasis;
      return acc;
    },
    { marketValue: 0, costBasis: 0 },
  );

  return prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      totalMarketValue: totals.marketValue,
      totalCostBasis: totals.costBasis,
      netWorth: totals.marketValue,
    },
  });
}

export async function recalculateUserNetWorth(userId: string) {
  const portfolios = await prisma.portfolio.findMany({ where: { userId } });
  return portfolios.reduce((sum, item) => sum + item.netWorth, 0);
}

export function computePositionMetrics(asset: Pick<Asset, 'quantity' | 'purchasePrice' | 'marketPrice'>) {
  const currentPrice = asset.marketPrice || 0;
  const costBasis = asset.quantity * asset.purchasePrice;
  const marketValue = asset.quantity * currentPrice;
  const profitLoss = marketValue - costBasis;
  const roiPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

  return { costBasis, marketValue, profitLoss, roiPercent, currentPrice };
}
