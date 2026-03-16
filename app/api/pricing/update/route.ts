import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recalculatePortfolioValue, updateAssetMarketValue } from '@/lib/services/pricing.service';
import { refreshFxRates } from '@/lib/pricing/fx.service';

export async function GET() {
  try {
    const fxRates = await refreshFxRates().catch(() => []);

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
        grouped.set(key, {
          assetIds: [asset.id],
          portfolioIds: new Set([asset.portfolioId]),
        });
      }
    }

    const updatedPortfolios = new Set<string>();
    let updatedAssets = 0;

    for (const group of grouped.values()) {
      await Promise.all(group.assetIds.map((assetId) => updateAssetMarketValue(assetId)));
      updatedAssets += group.assetIds.length;
      group.portfolioIds.forEach((portfolioId) => updatedPortfolios.add(portfolioId));
    }

    await Promise.all(Array.from(updatedPortfolios).map((portfolioId) => recalculatePortfolioValue(portfolioId)));

    return NextResponse.json({
      ok: true,
      updatedAssets,
      updatedPortfolios: updatedPortfolios.size,
      fxUpdated: fxRates.length,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'pricing_update_failed', detail: error instanceof Error ? error.message : 'unknown' }, { status: 500 });
  }
}
