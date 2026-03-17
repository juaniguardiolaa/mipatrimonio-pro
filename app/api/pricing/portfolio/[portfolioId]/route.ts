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

    let portfolio = await prisma.portfolio.findFirst({
      where: params.portfolioId === 'demo' ? { userId } : { id: params.portfolioId, userId },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: { userId, name: 'Portfolio Principal' },
      });
    }

    const assets = await prisma.asset.findMany({ where: { portfolioId: portfolio.id, userId } });

    await Promise.all(assets.map((asset) => updateAssetMarketValue(asset.id)));
    const updatedPortfolio = await recalculatePortfolioValue(portfolio.id);
    const userTotals = await recalculateUserNetWorth(userId);
    const ccl = await getFxRate('USD_ARS_CCL');

    const positions = (await prisma.asset.findMany({ where: { portfolioId: portfolio.id, userId } })).map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      ticker: asset.ticker || asset.symbol,
      assetType: asset.assetType,
      quantity: asset.quantity,
      purchasePrice: asset.purchasePrice,
      currency: asset.currency,
      ...computePositionMetrics(asset),
      lastPriceUpdate: asset.lastPriceUpdate,
    }));

    return NextResponse.json({
      ok: true,
      portfolio: updatedPortfolio,
      positions,
      netWorthArs: updatedPortfolio.netWorth,
      netWorthUsd: updatedPortfolio.netWorthUsd || userTotals.netWorthUsd || (ccl ? updatedPortfolio.netWorth / ccl : 0),
      fx: { ccl },
      timestamp: new Date(),
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'No se pudo obtener portfolio' }, { status: 500 });
  }
}
