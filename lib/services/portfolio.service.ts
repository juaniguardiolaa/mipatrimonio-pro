import { prisma } from '@/lib/db/prisma';

export async function listPortfolios(userId: string) {
  return prisma.portfolio.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function createPortfolio(userId: string, name: string) {
  return prisma.portfolio.create({ data: { userId, name } });
}
