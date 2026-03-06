import { z } from 'zod';
import { requireUserSession } from '@/lib/auth/session';
import { createAccount, listAccounts } from '@/lib/services/account.service';
import { jsonError } from '@/lib/utils/http';

const schema = z.object({
  portfolioId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  currency: z.string().length(3)
});

export async function GET(request: Request) {
  try {
    const session = await requireUserSession();
    const url = new URL(request.url);
    const portfolioId = url.searchParams.get('portfolioId') ?? undefined;
    const items = await listAccounts(session.user.id, portfolioId);
    return Response.json({ data: items.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible listar accounts', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUserSession();
    const payload = schema.parse(await request.json());
    const item = await createAccount(session.user.id, payload);
    return Response.json({ data: { ...item, createdAt: item.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    if (error instanceof z.ZodError) return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible crear account', 500);
  }
}
