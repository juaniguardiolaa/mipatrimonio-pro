import { prisma } from '@/lib/db/prisma';

export const FREE_PLAN_LIMITS = {
  portfolios: 1,
  assets: 20
};

export async function getUserSubscription(userId: string) {
  return prisma.subscription.findUnique({ where: { userId } });
}

export async function ensureCanCreatePortfolio(userId: string) {
  const [subscription, count] = await Promise.all([
    getUserSubscription(userId),
    prisma.portfolio.count({ where: { userId } })
  ]);

  const plan = subscription?.plan ?? 'free';
  if (plan === 'free' && count >= FREE_PLAN_LIMITS.portfolios) {
    throw new Error('FREE_PLAN_PORTFOLIO_LIMIT_REACHED');
  }
}

export async function ensureCanCreateAsset(userId: string) {
  const [subscription, count] = await Promise.all([
    getUserSubscription(userId),
    prisma.asset.count({ where: { userId } })
  ]);

  const plan = subscription?.plan ?? 'free';
  if (plan === 'free' && count >= FREE_PLAN_LIMITS.assets) {
    throw new Error('FREE_PLAN_ASSET_LIMIT_REACHED');
  }
}
