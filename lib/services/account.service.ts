import { prisma } from '@/lib/db/prisma';

export async function listAccounts(userId: string, portfolioId?: string) {
  return prisma.account.findMany({
    where: {
      userId,
      portfolioId: portfolioId || undefined
    },
    orderBy: { createdAt: 'asc' }
  });
}

export async function createAccount(
  userId: string,
  input: { portfolioId: string; name: string; type: string; currency: string }
) {
  return prisma.account.create({ data: { userId, ...input } });
}
