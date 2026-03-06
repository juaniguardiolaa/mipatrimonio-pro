import { prisma } from '@/lib/db/prisma';
import { jsonError } from '@/lib/utils/http';
import { logInfo } from '@/lib/utils/logger';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return jsonError('NOT_CONFIGURED', 'Stripe webhook no configurado', 500);
  }

  const event = await request.json();
  const type = event?.type as string | undefined;

  if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
    const object = event.data?.object;
    const stripeCustomerId = object?.customer as string;

    if (stripeCustomerId) {
      await prisma.subscription.updateMany({
        where: { stripeCustomerId },
        data: {
          stripeSubscriptionId: object?.id,
          status: object?.status ?? 'active',
          plan: object?.items?.data?.[0]?.price?.nickname?.toLowerCase?.() ?? 'pro'
        }
      });
    }
  }

  logInfo('stripe.webhook.received', { type });
  return Response.json({ received: true });
}
