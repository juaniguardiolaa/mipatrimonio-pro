import { prisma } from '@/lib/db/prisma';
import { recalculateNetWorthForUser } from '@/lib/services/networth.service';

export async function listLiabilities(userId: string, portfolioId?: string) {
  return prisma.liability.findMany({
    where: { userId, portfolioId: portfolioId || undefined },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createLiability(
  userId: string,
  input: {
    portfolioId: string;
    categoryId: string;
    currency: string;
    name: string;
    amount: number;
  }
) {
  const liability = await prisma.liability.create({ data: { ...input, userId } });
  await recalculateNetWorthForUser(userId, input.portfolioId);
  return liability;
}

export async function updateLiability(
  userId: string,
  id: string,
  input: Partial<{ portfolioId: string; categoryId: string; currency: string; name: string; amount: number }>
) {
  const current = await prisma.liability.findFirst({ where: { id, userId } });
  if (!current) return null;

  const updated = await prisma.liability.update({ where: { id }, data: input });
  await recalculateNetWorthForUser(userId, updated.portfolioId);
  return updated;
}

export async function deleteLiability(userId: string, id: string) {
  const current = await prisma.liability.findFirst({ where: { id, userId } });
  if (!current) return null;

  await prisma.liability.delete({ where: { id } });
  await recalculateNetWorthForUser(userId, current.portfolioId);
  return current;
}
