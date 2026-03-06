import { requireUserSession } from '@/lib/auth/session';
import {
  calculateNetWorthByPortfolio,
  calculateNetWorthForUser
} from '@/lib/services/networth.service';
import { jsonError } from '@/lib/utils/http';

export async function GET() {
  try {
    const session = await requireUserSession();
    const [summary, byPortfolio] = await Promise.all([
      calculateNetWorthForUser(session.user.id),
      calculateNetWorthByPortfolio(session.user.id)
    ]);

    return Response.json({ data: { ...summary, byPortfolio } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible obtener resumen', 500);
  }
}
