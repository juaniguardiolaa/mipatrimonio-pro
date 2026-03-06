import { requireUserSession } from '@/lib/auth/session';
import { syncAllBrokersForUser, syncAllUsersBrokerConnections } from '@/lib/integrations/broker.service';
import { jsonError } from '@/lib/utils/http';

export async function POST() {
  try {
    const session = await requireUserSession();
    const result = await syncAllBrokersForUser(session.user.id);
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return jsonError('INTERNAL_SERVER_ERROR', 'No se pudo sincronizar integraciones', 500);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return jsonError('FORBIDDEN', 'No autorizado para sync automático', 403);
  }

  try {
    const result = await syncAllUsersBrokerConnections();
    return Response.json({ data: result });
  } catch {
    return jsonError('INTERNAL_SERVER_ERROR', 'Sync automático falló', 500);
  }
}
