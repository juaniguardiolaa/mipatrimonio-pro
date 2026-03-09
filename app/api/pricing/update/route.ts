import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentPrice, recalculatePortfolioValue } from '@/lib/services/pricing.service';

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
      select: { id: true, symbol: true, assetType: true, quantity: true, portfolioId: true },
    });

    const grouped = new Map<string, { symbol: string; assetType: string; assetIds: string[]; portfolioIds: Set<string> }>();

    for (const asset of assets) {
      const key = `${asset.symbol.toUpperCase()}-${asset.assetType.toUpperCase()}`;
      const found = grouped.get(key);
      if (found) {
        found.assetIds.push(asset.id);
        found.portfolioIds.add(asset.portfolioId);
      } else {
        grouped.set(key, {
          symbol: asset.symbol,
          assetType: asset.assetType,
          assetIds: [asset.id],
          portfolioIds: new Set([asset.portfolioId]),
        });
      }
    }

    const updatedAssets: string[] = [];
    const updatedPortfolios = new Set<string>();

    for (const group of grouped.values()) {
      const price = await getCurrentPrice(group.symbol, group.assetType);
      if (!price) continue;

      await prisma.asset.updateMany({
        where: { id: { in: group.assetIds } },
        data: {
          marketPrice: price.price,
          lastPriceUpdate: price.timestamp,
        },
      });

      const freshAssets = await prisma.asset.findMany({ where: { id: { in: group.assetIds } } });
      await Promise.all(
        freshAssets.map((asset) =>
          prisma.asset.update({
            where: { id: asset.id },
            data: { marketValue: asset.quantity * price.price },
          }),
        ),
      );

      group.assetIds.forEach((id) => updatedAssets.push(id));
      group.portfolioIds.forEach((id) => updatedPortfolios.add(id));
    }

    await Promise.all(Array.from(updatedPortfolios).map((portfolioId) => recalculatePortfolioValue(portfolioId)));

    return NextResponse.json({ ok: true, updatedAssets: updatedAssets.length, updatedPortfolios: updatedPortfolios.size, timestamp: new Date() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'pricing_update_failed', detail: error instanceof Error ? error.message : 'unknown' }, { status: 500 });
  }
}
