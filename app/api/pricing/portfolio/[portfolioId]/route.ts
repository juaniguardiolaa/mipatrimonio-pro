import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computePositionMetrics, recalculatePortfolioValue, updateAssetMarketValue } from '@/lib/services/pricing.service';

const demoPositions = [
  { id: '1', symbol: 'AAPL', quantity: 10, purchasePrice: 180, marketPrice: 194 },
  { id: '2', symbol: 'SPY', quantity: 15, purchasePrice: 490, marketPrice: 505 },
  { id: '3', symbol: 'BTC', quantity: 0.25, purchasePrice: 58000, marketPrice: 62000 },
];

export async function GET(_: Request, { params }: { params: { portfolioId: string } }) {
  try {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });

    if (!portfolio) {
      const positions = demoPositions.map((asset) => ({ ...asset, ...computePositionMetrics(asset), lastPriceUpdate: new Date() }));
      return NextResponse.json({ ok: true, portfolio: null, positions, demo: true, timestamp: new Date() });
    }

    const assets = await prisma.asset.findMany({ where: { portfolioId: params.portfolioId } });

    await Promise.all(assets.map((asset) => updateAssetMarketValue(asset.id)));
    const updatedPortfolio = await recalculatePortfolioValue(params.portfolioId);

    const positions = (await prisma.asset.findMany({ where: { portfolioId: params.portfolioId } })).map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      quantity: asset.quantity,
      purchasePrice: asset.purchasePrice,
      ...computePositionMetrics(asset),
      lastPriceUpdate: asset.lastPriceUpdate,
    }));

    return NextResponse.json({ ok: true, portfolio: updatedPortfolio, positions, timestamp: new Date() });
  } catch {
    const positions = demoPositions.map((asset) => ({ ...asset, ...computePositionMetrics(asset), lastPriceUpdate: new Date() }));
    return NextResponse.json({ ok: true, portfolio: null, positions, demo: true, timestamp: new Date() });
  }
}
