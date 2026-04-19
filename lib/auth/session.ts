import { cookies } from 'next/headers';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';

const SESSION_COOKIE = 'mpp_session';
const SESSION_TTL_DAYS = 30;

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
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });

  cookies().set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });

  console.info('[auth.session] cookie set', {
    userId,
    cookieName: SESSION_COOKIE,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    hasDomainOverride: false,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }
  cookies().delete(SESSION_COOKIE);
}

export async function getAuthSession() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    console.info('[auth.session] session not found: missing cookie');
    return null;
  }

  const dbSession = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!dbSession) {
    console.info('[auth.session] session not found in database');
    return null;
  }

  if (dbSession.expires < new Date()) {
    console.info('[auth.session] session expired', { userId: dbSession.userId, expires: dbSession.expires.toISOString() });
    return null;
  }

  console.info('[auth.session] session found', { userId: dbSession.user.id });
  return {
    user: dbSession.user,
    expires: dbSession.expires,
  };
}
