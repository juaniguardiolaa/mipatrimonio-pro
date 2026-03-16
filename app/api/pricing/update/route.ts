import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recalculatePortfolioValue, updateAssetMarketValue } from '@/lib/services/pricing.service';
import { refreshFxRates } from '@/lib/pricing/fx.service';

const RATE_LIMIT_MS = 60_000;
let lastUpdateExecution = 0;
let lastCachedResponse: Record<string, unknown> | null = null;

export async function GET(request: NextRequest) {
  const isCronJob = request.headers.get('x-cron-job') === 'true';
  const now = Date.now();

  if (!isCronJob && now - lastUpdateExecution < RATE_LIMIT_MS && lastCachedResponse) {
    return NextResponse.json({
      ...lastCachedResponse,
      cached: true,
      cacheAgeMs: now - lastUpdateExecution,
      timestamp: new Date(),
    });
  }

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

    const responseBody = {
      ok: true,
      updatedAssets,
      updatedPortfolios: updatedPortfolios.size,
      fxUpdated: fxRates.length,
      cached: false,
    };

    lastUpdateExecution = now;
    lastCachedResponse = responseBody;

    return NextResponse.json({ ...responseBody, timestamp: new Date() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'pricing_update_failed', detail: error instanceof Error ? error.message : 'unknown' }, { status: 500 });
  }
}
