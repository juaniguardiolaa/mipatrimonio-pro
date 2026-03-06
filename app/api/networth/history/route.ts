import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireUserSession } from '@/lib/auth/session';
import { jsonError } from '@/lib/utils/http';

const querySchema = z.object({
  portfolioId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(365).default(180)
});

export async function GET(request: Request) {
  try {
    const session = await requireUserSession();
    const url = new URL(request.url);
    const params = querySchema.parse({
      portfolioId: url.searchParams.get('portfolioId') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined
    });

    const history = await prisma.netWorthHistory.findMany({
      where: {
        userId: session.user.id,
        portfolioId: params.portfolioId || undefined,
        date: {
          gte: params.from ? new Date(params.from) : undefined,
          lte: params.to ? new Date(params.to) : undefined
        }
      },
      orderBy: { date: 'asc' },
      take: params.limit
    });

    return Response.json({
      data: history.map((point) => ({
        date: point.date.toISOString(),
        netWorth: Number(point.netWorth),
        portfolioId: point.portfolioId
      })),
      meta: { count: history.length }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    }
    if (error instanceof z.ZodError) {
      return jsonError('VALIDATION_ERROR', 'Query params inválidos', 422, error.flatten());
    }
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible obtener historial', 500);
  }
}
