import { prisma } from '@/lib/db/prisma';
import type { NetWorthSummary, PortfolioNetWorth } from '@/types';

export async function calculateAssetsTotal(userId: string, portfolioId?: string, accountId?: string) {
  const result = await prisma.asset.aggregate({
    where: { userId, portfolioId: portfolioId || undefined, accountId: accountId || undefined },
    _sum: { value: true }
  });

  return Number(result._sum.value ?? 0);
}

export async function calculateLiabilitiesTotal(userId: string, portfolioId?: string) {
  const result = await prisma.liability.aggregate({
    where: { userId, portfolioId: portfolioId || undefined },
    _sum: { amount: true }
  });

  return Number(result._sum.amount ?? 0);
}

export function calculateNetWorth(assetsTotal: number, liabilitiesTotal: number) {
  return assetsTotal - liabilitiesTotal;
}

export async function calculateNetWorthByPortfolio(userId: string): Promise<PortfolioNetWorth[]> {
  const portfolios = await prisma.portfolio.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

  return Promise.all(
    portfolios.map(async (portfolio) => {
      const [assetsTotal, liabilitiesTotal] = await Promise.all([
        calculateAssetsTotal(userId, portfolio.id),
        calculateLiabilitiesTotal(userId, portfolio.id)
      ]);

      return {
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        assetsTotal,
        liabilitiesTotal,
        netWorth: calculateNetWorth(assetsTotal, liabilitiesTotal)
      };
    })
  );
}

export async function calculateNetWorthByAccount(userId: string, accountId: string) {
  const assetsTotal = await calculateAssetsTotal(userId, undefined, accountId);
  return {
    accountId,
    assetsTotal,
    liabilitiesTotal: 0,
    netWorth: assetsTotal
  };
}

export async function calculateNetWorthForUser(userId: string): Promise<NetWorthSummary> {
  const [assetsTotal, liabilitiesTotal, latestHistory] = await Promise.all([
    calculateAssetsTotal(userId),
    calculateLiabilitiesTotal(userId),
    prisma.netWorthHistory.findFirst({ where: { userId }, orderBy: { date: 'desc' } })
  ]);

  const netWorth = calculateNetWorth(assetsTotal, liabilitiesTotal);

  const previousMonthDate = new Date();
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

  const previous = await prisma.netWorthHistory.findFirst({
    where: { userId, date: { lte: previousMonthDate } },
    orderBy: { date: 'desc' }
  });

  return {
    assetsTotal,
    liabilitiesTotal,
    netWorth,
    monthlyChange: netWorth - Number(previous?.netWorth ?? netWorth),
    lastUpdatedAt: latestHistory?.date.toISOString() ?? null
  };
}

export async function recalculateNetWorthForUser(userId: string, portfolioId?: string, accountId?: string) {
  const [assetsTotal, liabilitiesTotal] = await Promise.all([
    calculateAssetsTotal(userId, portfolioId, accountId),
    calculateLiabilitiesTotal(userId, portfolioId)
  ]);

  const netWorth = calculateNetWorth(assetsTotal, liabilitiesTotal);
  await prisma.netWorthHistory.create({
    data: { userId, portfolioId, accountId, netWorth, date: new Date() }
  });

  return calculateNetWorthForUser(userId);
}
