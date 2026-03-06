import { z } from 'zod';
import { requireUserSession } from '@/lib/auth/session';
import { createPortfolio, listPortfolios } from '@/lib/services/portfolio.service';
import { ensureCanCreatePortfolio } from '@/lib/services/billing.service';
import { jsonError } from '@/lib/utils/http';

const schema = z.object({ name: z.string().min(1) });

export async function GET() {
  try {
    const session = await requireUserSession();
    const items = await listPortfolios(session.user.id);
    return Response.json({ data: items.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible listar portfolios', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUserSession();
    const payload = schema.parse(await request.json());
    await ensureCanCreatePortfolio(session.user.id);
    const item = await createPortfolio(session.user.id, payload.name);
    return Response.json({ data: { ...item, createdAt: item.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    if (error instanceof Error && error.message === 'FREE_PLAN_PORTFOLIO_LIMIT_REACHED') {
      return jsonError('PLAN_LIMIT_REACHED', 'Límite del plan Free: 1 portfolio', 403);
    }
    if (error instanceof z.ZodError) return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible crear portfolio', 500);
  }
}
