import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computePositionMetrics, recalculatePortfolioValue, recalculateUserNetWorth, updateAssetMarketValue } from '@/lib/services/pricing.service';
import { getFxRate } from '@/lib/pricing/fx.service';
import { getAuthSession } from '@/lib/auth/session';

export async function GET(_: Request, { params }: { params: { portfolioId: string } }) {
  try {
    const session = await getAuthSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const requestedPortfolioId = params.portfolioId;
    const aggregateAllPortfolios = requestedPortfolioId === 'demo';

    console.info('[pricing.portfolio] request', {
      userId,
      requestedPortfolioId,
      aggregateAllPortfolios,
    });

    let targetPortfolioIds: string[] = [];

    if (aggregateAllPortfolios) {
      const portfolios = await prisma.portfolio.findMany({ where: { userId }, select: { id: true } });
      targetPortfolioIds = portfolios.map((portfolio) => portfolio.id);

      if (targetPortfolioIds.length === 0) {
        const created = await prisma.portfolio.create({
          data: { userId, name: 'Portfolio Principal' },
          select: { id: true },
        });
        targetPortfolioIds = [created.id];
      }
    } else {
      let portfolio = await prisma.portfolio.findFirst({ where: { id: requestedPortfolioId, userId }, select: { id: true } });

      if (!portfolio) {
        portfolio = await prisma.portfolio.create({
          data: { userId, name: 'Portfolio Principal' },
          select: { id: true },
        });
      }

      targetPortfolioIds = [portfolio.id];
    }

    const assets = await prisma.asset.findMany({ where: { userId, portfolioId: { in: targetPortfolioIds } } });

    console.info('[pricing.portfolio] assets found', {
      requestedPortfolioId,
      targetPortfolioCount: targetPortfolioIds.length,
      assetsCount: assets.length,
    });

    const pricingResults = await Promise.allSettled(assets.map((asset) => updateAssetMarketValue(asset.id)));
    const successfulUpdates = pricingResults
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof updateAssetMarketValue>>> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter(Boolean);

    const failedUpdates = pricingResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failedUpdates.length > 0) {
      console.warn('[pricing.portfolio] partial pricing failure', {
        requestedPortfolioId,
        failedUpdates: failedUpdates.length,
        successfulUpdates: successfulUpdates.length,
      });
    }

    const updatedPortfolioIds = [...new Set(assets.map((asset) => asset.portfolioId))];
    for (const portfolioId of updatedPortfolioIds) {
      await recalculatePortfolioValue(portfolioId);
    }

    const userTotals = await recalculateUserNetWorth(userId);
    const ccl = await getFxRate('USD_ARS_CCL');

    const positions = (await prisma.asset.findMany({ where: { userId, portfolioId: { in: targetPortfolioIds } } })).map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      ticker: asset.ticker || asset.symbol,
      assetType: asset.assetType,
      quantity: asset.quantity,
      purchasePrice: asset.purchasePrice,
      currency: asset.currency,
      ...computePositionMetrics(asset),
      lastPriceUpdate: asset.lastPriceUpdate,
      portfolioId: asset.portfolioId,
    }));

    const scopedNetWorthArs = positions.reduce((sum, position) => sum + position.marketValue, 0);
    const scopedNetWorthUsd = positions.reduce((sum, position) => sum + position.marketValueUsd, 0);

    return NextResponse.json({
      ok: true,
      aggregateAllPortfolios,
      requestedPortfolioId,
      portfolioIds: targetPortfolioIds,
      positions,
      netWorthArs: aggregateAllPortfolios ? userTotals.netWorthArs : scopedNetWorthArs,
      netWorthUsd: aggregateAllPortfolios
        ? userTotals.netWorthUsd || (ccl ? userTotals.netWorthArs / ccl : 0)
        : scopedNetWorthUsd || (ccl ? scopedNetWorthArs / ccl : 0),
      fx: { ccl },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[pricing.portfolio] fatal error', {
      message: error instanceof Error ? error.message : 'unknown error',
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({
      ok: true,
      warning: 'partial data',
      positions: [],
    });
  }
}
