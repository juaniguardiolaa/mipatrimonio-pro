import { cookies } from 'next/headers';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';

const SESSION_COOKIE = 'mpp_session';
const SESSION_TTL_DAYS = 30;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString('hex');
  const sessionToken = hashToken(rawToken);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });

  cookies().set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: hashToken(token) } });
  }
  cookies().delete(SESSION_COOKIE);
}

export async function getAuthSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const dbSession = await prisma.session.findUnique({
    where: { sessionToken: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!dbSession || dbSession.expires < new Date()) return null;

  return {
    user: dbSession.user,
    expires: dbSession.expires,
  };
}
