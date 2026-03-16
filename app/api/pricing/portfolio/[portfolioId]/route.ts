import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computePositionMetrics, recalculatePortfolioValue, recalculateUserNetWorth, updateAssetMarketValue } from '@/lib/services/pricing.service';
import { getFxRate } from '@/lib/pricing/fx.service';

const demoPositions = [
  { id: '1', symbol: 'AAPL', ticker: 'AAPL', assetType: 'CEDEAR', quantity: 10, purchasePrice: 180000, marketPrice: 194500, marketPriceUsd: 194 },
  { id: '2', symbol: 'AL30', ticker: 'AL30', assetType: 'BOND', quantity: 1500, purchasePrice: 640, marketPrice: 702, marketPriceUsd: 0.56 },
  { id: '3', symbol: 'BTC', ticker: 'BTC', assetType: 'CRYPTO', quantity: 0.25, purchasePrice: 58000000, marketPrice: 74400000, marketPriceUsd: 62000 },
];

export async function GET(_: Request, { params }: { params: { portfolioId: string } }) {
  try {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });

    if (!portfolio) {
      const positions = demoPositions.map((asset) => ({ ...asset, ...computePositionMetrics(asset), lastPriceUpdate: new Date() }));
      const netWorthArs = positions.reduce((sum, p) => sum + p.marketValue, 0);
      const ccl = (await getFxRate('USD_ARS_CCL')) ?? 1200;
      return NextResponse.json({
        ok: true,
        portfolio: null,
        positions,
        netWorthArs,
        netWorthUsd: netWorthArs / ccl,
        fx: { ccl },
        demo: true,
        timestamp: new Date(),
      });
    }

    const assets = await prisma.asset.findMany({ where: { portfolioId: params.portfolioId } });

    await Promise.all(assets.map((asset) => updateAssetMarketValue(asset.id)));
    const updatedPortfolio = await recalculatePortfolioValue(params.portfolioId);
    const userTotals = await recalculateUserNetWorth(portfolio.userId);
    const ccl = await getFxRate('USD_ARS_CCL');

    const positions = (await prisma.asset.findMany({ where: { portfolioId: params.portfolioId } })).map((asset) => ({
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
    const positions = demoPositions.map((asset) => ({ ...asset, ...computePositionMetrics(asset), lastPriceUpdate: new Date() }));
    const netWorthArs = positions.reduce((sum, p) => sum + p.marketValue, 0);
    return NextResponse.json({ ok: true, portfolio: null, positions, netWorthArs, netWorthUsd: netWorthArs / 1200, demo: true, timestamp: new Date() });
  }
}
