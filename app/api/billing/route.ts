import { requireUserSession } from '@/lib/auth/session';
import { getUserSubscription } from '@/lib/services/billing.service';
import { jsonError } from '@/lib/utils/http';

export async function GET() {
  try {
    const session = await requireUserSession();
    const subscription = await getUserSubscription(session.user.id);
    return Response.json({
      data: subscription ?? {
        plan: 'free',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('UNAUTHORIZED', 'No autenticado', 401);
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible obtener suscripción', 500);
  }
}
