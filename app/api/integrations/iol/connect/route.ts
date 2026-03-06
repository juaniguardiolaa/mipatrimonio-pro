import { z } from 'zod';
import { requireUserSession } from '@/lib/auth/session';
import { connectBroker } from '@/lib/integrations/broker.service';
import { jsonError } from '@/lib/utils/http';

const schema = z.object({ apiKey: z.string().min(1), apiSecret: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const session = await requireUserSession();
    const payload = schema.parse(await request.json());
    const connection = await connectBroker(session.user.id, 'iol', payload.apiKey, payload.apiSecret);

    return Response.json({
      data: {
        id: connection.id,
        broker: connection.broker,
        createdAt: connection.createdAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    if (error instanceof z.ZodError) return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    return jsonError('INTERNAL_SERVER_ERROR', 'No se pudo conectar IOL', 500);
  }
}
