import { z } from 'zod';
import { requireUserSession } from '@/lib/auth/session';
import { deleteLiability, updateLiability } from '@/lib/services/liability.service';
import { jsonError } from '@/lib/utils/http';

const patchSchema = z
  .object({
    portfolioId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    currency: z.string().length(3).optional(),
    name: z.string().min(1).optional(),
    amount: z.number().positive().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Debe incluir al menos un campo' });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireUserSession();
    const payload = patchSchema.parse(await request.json());
    const liability = await updateLiability(session.user.id, params.id, payload);
    if (!liability) return jsonError('NOT_FOUND', 'Pasivo no encontrado', 404);

    return Response.json({
      data: { ...liability, amount: Number(liability.amount), createdAt: liability.createdAt.toISOString() }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    if (error instanceof z.ZodError) return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible actualizar pasivo', 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireUserSession();
    const liability = await deleteLiability(session.user.id, params.id);
    if (!liability) return jsonError('NOT_FOUND', 'Pasivo no encontrado', 404);
    return Response.json({ data: { id: params.id, deleted: true } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible eliminar pasivo', 500);
  }
}
