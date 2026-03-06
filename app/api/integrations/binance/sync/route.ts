import { requireUserSession } from '@/lib/auth/session';
import { syncBrokerConnection } from '@/lib/integrations/broker.service';
import { jsonError } from '@/lib/utils/http';

export async function POST() {
  try {
    const session = await requireUserSession();
    const result = await syncBrokerConnection(session.user.id, 'binance');
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    if (error instanceof Error && error.message === 'BROKER_NOT_CONNECTED') {
      return jsonError('BROKER_NOT_CONNECTED', 'Debes conectar Binance primero', 404);
    }
    return jsonError('INTERNAL_SERVER_ERROR', 'No se pudo sincronizar Binance', 500);
  }
}
