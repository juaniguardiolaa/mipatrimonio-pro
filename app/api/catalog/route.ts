import { prisma } from '@/lib/db/prisma';
import { requireUserSession } from '@/lib/auth/session';
import { jsonError } from '@/lib/utils/http';

export async function GET() {
  try {
    await requireUserSession();
    const [assetCategories, liabilityCategories, currencies] = await Promise.all([
      prisma.assetCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.liabilityCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.currency.findMany({ orderBy: { code: 'asc' } })
    ]);

    return Response.json({ data: { assetCategories, liabilityCategories, currencies } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible cargar catálogo', 500);
  }
}
