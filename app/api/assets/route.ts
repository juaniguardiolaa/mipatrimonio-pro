import { z } from 'zod';
import { requireUserSession } from '@/lib/auth/session';
import { createAsset, listAssets } from '@/lib/services/asset.service';
import { jsonError } from '@/lib/utils/http';
import { logError } from '@/lib/utils/logger';
import { enforceRateLimit } from '@/lib/utils/rate-limit';

const assetSchema = z.object({
  portfolioId: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  currency: z.string().length(3),
  name: z.string().min(1),
  value: z.number().positive()
});

export async function GET(request: Request) {
  try {
    const session = await requireUserSession();
    const url = new URL(request.url);
    const portfolioId = url.searchParams.get('portfolioId') ?? undefined;
    const assets = await listAssets(session.user.id, portfolioId);

    return Response.json({
      data: assets.map((asset) => ({ ...asset, value: Number(asset.value), createdAt: asset.createdAt.toISOString() }))
    });
  } catch (error) {
    logError('assets.get.failed', { error: String(error) });
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible listar activos', 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUserSession();
    if (!enforceRateLimit(`assets:create:${session.user.id}`, 40, 60_000)) {
      return jsonError('RATE_LIMITED', 'Demasiadas solicitudes', 429);
    }

    const payload = assetSchema.parse(await request.json());
    const asset = await createAsset(session.user.id, payload);

    return Response.json(
      { data: { ...asset, value: Number(asset.value), createdAt: asset.createdAt.toISOString() } },
      { status: 201 }
    );
  } catch (error) {
    logError('assets.post.failed', { error: String(error) });
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    }
    if (error instanceof Error && error.message === 'FREE_PLAN_ASSET_LIMIT_REACHED') {
      return jsonError('PLAN_LIMIT_REACHED', 'Límite del plan Free alcanzado (20 assets)', 403);
    }
    if (error instanceof z.ZodError) {
      return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    }
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible crear activo', 500);
  }
}
