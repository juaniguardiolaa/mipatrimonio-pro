import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { jsonError } from '@/lib/utils/http';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) return jsonError('CONFLICT', 'Usuario ya existe', 409);

    const hash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        password: hash,
        subscriptions: { create: { plan: 'free', status: 'active' } }
      }
    });

    return Response.json({ data: { id: user.id, email: user.email } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError('VALIDATION_ERROR', 'Payload inválido', 422, error.flatten());
    return jsonError('INTERNAL_SERVER_ERROR', 'No fue posible registrar usuario', 500);
  }
}
