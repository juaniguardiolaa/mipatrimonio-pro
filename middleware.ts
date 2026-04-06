import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
 
const SESSION_COOKIE = 'mpp_session';
 
export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
 
  // No cookie → redirect immediately (fast path, no DB call needed)
  if (!sessionToken) {
    return redirectToLogin(request);
  }
 
  // ── FIX: The original middleware only checked cookie presence, not validity.
  // Expired or deleted sessions passed through, causing a flash of the protected
  // page before API calls returned 401s.
  //
  // We now validate the session in the DB at the edge. This adds one DB round-
  // trip per navigation, but protects all matched routes properly.
  //
  // Trade-off note: for very high-traffic apps, switch to a signed JWT cookie
  // that can be verified without a DB call. For this app's scale, DB lookup is fine.
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      select: { expires: true },
    });
 
    if (!session || session.expires < new Date()) {
      return redirectToLogin(request);
    }
  } catch {
    // If the DB is unreachable, fail open (allow the request) rather than
    // locking out all users. The individual API handlers still validate via
    // getAuthSession() and will return 401 if needed.
    console.warn('[middleware] db_check_failed — failing open');
  }
 
  return NextResponse.next();
}
 
function redirectToLogin(request: NextRequest) {
  const url = new URL('/login', request.url);
  url.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}
 
export const config = {
  matcher: ['/dashboard/:path*', '/accounts/:path*', '/investments/:path*'],
};
 
