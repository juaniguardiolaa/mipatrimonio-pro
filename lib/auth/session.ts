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
 
  // Always run timingSafeEqual regardless of length to avoid timing oracles.
  // Pad the shorter buffer so lengths match before the constant-time compare.
  const maxLen = Math.max(candidate.length, expected.length);
  const paddedCandidate = Buffer.concat([candidate, Buffer.alloc(maxLen - candidate.length)]);
  const paddedExpected = Buffer.concat([expected, Buffer.alloc(maxLen - expected.length)]);
 
  // Length mismatch means hashes are different — but we still do the full
  // constant-time compare to avoid leaking that fact via timing.
  const lengthMatch = candidate.length === expected.length;
  const valueMatch = timingSafeEqual(paddedCandidate, paddedExpected);
  return lengthMatch && valueMatch;
}
 
export async function createSession(userId: string) {
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
 
  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });
 
  cookies().set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
 
  // ── FIX: Never log the session token value, even in development.
  console.info('[auth.session] session_created', { userId });
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
 
  // ── FIX: removed console.log('cookies:', cookieStore.getAll()) — that
  // printed the raw session token to Vercel logs on every authenticated request,
  // leaking credentials to anyone with log access.
  // Debug logging is only allowed in development, and never logs the token value.
 
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
 
  if (!sessionToken) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[auth.session] no_cookie_present');
    }
    return null;
  }
 
  const dbSession = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
 
  if (!dbSession) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[auth.session] session_not_found_in_db');
    }
    return null;
  }
 
  if (dbSession.expires < new Date()) {
    console.info('[auth.session] session_expired', { userId: dbSession.userId });
    return null;
  }
 
  if (process.env.NODE_ENV === 'development') {
    console.info('[auth.session] session_valid', { userId: dbSession.user.id });
  }
 
  return {
    user: dbSession.user,
    expires: dbSession.expires,
  };
}
 
