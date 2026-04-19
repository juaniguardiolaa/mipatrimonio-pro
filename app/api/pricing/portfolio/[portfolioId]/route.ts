import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  computePositionMetrics,
  recalculatePortfolioValue,
  recalculateUserNetWorth,
  updateAssetMarketValue,
} from '@/lib/services/pricing.service';
import { getFxRate } from '@/lib/pricing/fx.service';
import { getAuthSession } from '@/lib/auth/session';
 
export async function GET(
  _: Request,
  { params }: { params: { portfolioId: string } },
) {
  try {
    const session = await getAuthSession();
    const userId = session?.user?.id;
 
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
 
    const requestedPortfolioId = params.portfolioId;
    const aggregateAllPortfolios = requestedPortfolioId === 'demo';
 
    let targetPortfolioIds: string[] = [];
 
    if (aggregateAllPortfolios) {
      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
        select: { id: true },
      });
      targetPortfolioIds = portfolios.map((p) => p.id);
 
      if (targetPortfolioIds.length === 0) {
        const created = await prisma.portfolio.create({
          data: { userId, name: 'Portfolio Principal' },
          select: { id: true },
        });
        targetPortfolioIds = [created.id];
      }
    } else {
      let portfolio = await prisma.portfolio.findFirst({
        where: { id: requestedPortfolioId, userId },
        select: { id: true },
      });
 
      if (!portfolio) {
        portfolio = await prisma.portfolio.create({
          data: { userId, name: 'Portfolio Principal' },
          select: { id: true },
        });
      }
 
      targetPortfolioIds = [portfolio.id];
    }
 
    const assets = await prisma.asset.findMany({
      where: { userId, portfolioId: { in: targetPortfolioIds } },
    });
 
    // ── Update market prices for each asset ──────────────────────────────
    const pricingResults = await Promise.allSettled(
      assets.map((asset) => updateAssetMarketValue(asset.id)),
    );
 
    const failedCount = pricingResults.filter((r) => r.status === 'rejected').length;
    const succeededCount = pricingResults.filter((r) => r.status === 'fulfilled').length;
 
    if (failedCount > 0) {
      console.warn('[pricing.portfolio] partial_failure', { failedCount, succeededCount });
    }
 
    // ── Recalculate portfolio-level aggregates ────────────────────────────
    const updatedPortfolioIds = [...new Set(assets.map((a) => a.portfolioId))];
    for (const portfolioId of updatedPortfolioIds) {
      await recalculatePortfolioValue(portfolioId);
    }
 
    // ── FIX: Only recalculate user net worth (and write history) when we
    // actually updated at least one asset price successfully.
    // This prevents a new NetWorthHistory row on every dashboard reload.
    let userTotals = { netWorthArs: 0, netWorthUsd: 0 };
    if (succeededCount > 0) {
      userTotals = await recalculateUserNetWorth(userId);
    } else {
      // Compute totals directly from the portfolio rows without writing history
      const portfolios = await prisma.portfolio.findMany({ where: { userId } });
      userTotals = {
        netWorthArs: portfolios.reduce((s, p) => s + p.netWorth, 0),
        netWorthUsd: portfolios.reduce((s, p) => s + (p.netWorthUsd || 0), 0),
      };
    }
 
    const ccl = await getFxRate('USD_ARS_CCL');
 
    // ── Build position metrics ────────────────────────────────────────────
    const freshAssets = await prisma.asset.findMany({
      where: { userId, portfolioId: { in: targetPortfolioIds } },
    });
 
    const positions = freshAssets.map((asset) => ({
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
 
    const scopedNetWorthArs = positions.reduce((s, p) => s + p.marketValue, 0);
    const scopedNetWorthUsd = positions.reduce((s, p) => s + p.marketValueUsd, 0);
 
    return NextResponse.json({
      ok: true,
      aggregateAllPortfolios,
      requestedPortfolioId,
      portfolioIds: targetPortfolioIds,
      positions,
      netWorthArs: aggregateAllPortfolios ? userTotals.netWorthArs : scopedNetWorthArs,
      netWorthUsd: aggregateAllPortfolios
        ? userTotals.netWorthUsd ||
          (ccl ? userTotals.netWorthArs / ccl : 0)
        : scopedNetWorthUsd || (ccl ? scopedNetWorthArs / ccl : 0),
      fx: { ccl },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[pricing.portfolio] fatal_error', {
      message: error instanceof Error ? error.message : 'unknown',
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({ ok: false, warning: 'partial data', positions: [] });
  }
}
 
