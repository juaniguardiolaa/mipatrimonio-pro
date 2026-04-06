import { NextRequest, NextResponse } from 'next/server';
 
const SESSION_COOKIE = 'mpp_session';
 
/**
 * Next.js middleware runs on the Edge Runtime.
 * The Edge Runtime does NOT support Node.js APIs, native modules, or
 * Prisma Client — importing '@/lib/db' here crashes the deployment.
 *
 * Strategy:
 *   - Cookie presence check here (fast, zero latency, no DB).
 *   - Full session validity (expiry, DB lookup) is enforced inside each
 *     API route and Server Component via getAuthSession().
 *   - The small window where an expired cookie passes the middleware
 *     is acceptable: the page will immediately get 401s from its API
 *     calls and redirect to /login via the client-side error handling.
 */
export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
 
  if (!sessionToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
 
  return NextResponse.next();
}
 
export const config = {
  matcher: ['/dashboard/:path*', '/accounts/:path*', '/investments/:path*'],
};
 
