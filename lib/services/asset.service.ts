import { prisma } from '@/lib/db/prisma';
import { ensureCanCreateAsset } from '@/lib/services/billing.service';
import { recalculateNetWorthForUser } from '@/lib/services/networth.service';

export async function listAssets(userId: string, portfolioId?: string) {
  return prisma.asset.findMany({
    where: { userId, portfolioId: portfolioId || undefined },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createAsset(
  userId: string,
  input: {
    portfolioId: string;
    accountId: string;
    categoryId: string;
    currency: string;
    name: string;
    value: number;
  }
) {
  await ensureCanCreateAsset(userId);

  const asset = await prisma.asset.create({
    data: { ...input, userId }
  });
  await recalculateNetWorthForUser(userId, input.portfolioId, input.accountId);
  return asset;
}

export async function updateAsset(
  userId: string,
  id: string,
  input: Partial<{
    portfolioId: string;
    accountId: string;
    categoryId: string;
    currency: string;
    name: string;
    value: number;
  }>
) {
  const current = await prisma.asset.findFirst({ where: { id, userId } });
  if (!current) return null;

  const updated = await prisma.asset.update({ where: { id }, data: input });
  await recalculateNetWorthForUser(userId, updated.portfolioId, updated.accountId);
  return updated;
}

export async function deleteAsset(userId: string, id: string) {
  const current = await prisma.asset.findFirst({ where: { id, userId } });
  if (!current) return null;

  await prisma.asset.delete({ where: { id } });
  await recalculateNetWorthForUser(userId, current.portfolioId, current.accountId);
  return current;
}
