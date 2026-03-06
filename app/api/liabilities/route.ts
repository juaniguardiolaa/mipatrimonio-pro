import { z } from 'zod';
import { requireUserSession } from '@/lib/auth/session';
import { createLiability, listLiabilities } from '@/lib/services/liability.service';
import { jsonError } from '@/lib/utils/http';
import { enforceRateLimit } from '@/lib/utils/rate-limit';

const liabilitySchema = z.object({
  portfolioId: z.string().min(1),
  categoryId: z.string().min(1),
  currency: z.string().length(3),
  name: z.string().min(1),
  amount: z.number().positive()
});

export async function GET(request: Request) {
  try {
    const session = await requireUserSession();
    const url = new URL(request.url);
    const portfolioId = url.searchParams.get('portfolioId') ?? undefined;
    const liabilities = await listLiabilities(session.user.id, portfolioId);

    return Response.json({
      data: liabilities.map((item) => ({ ...item, amount: Number(item.amount), createdAt: item.createdAt.toISOString() }))
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible listar pasivos', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUserSession();
    if (!enforceRateLimit(`liabilities:create:${session.user.id}`, 40, 60_000)) {
      return jsonError('RATE_LIMITED', 'Demasiadas solicitudes', 429);
    }

    const payload = liabilitySchema.parse(await request.json());
    const liability = await createLiability(session.user.id, payload);

    return Response.json(
      { data: { ...liability, amount: Number(liability.amount), createdAt: liability.createdAt.toISOString() } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    if (error instanceof z.ZodError) return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible crear pasivo', 500);
  }
}
