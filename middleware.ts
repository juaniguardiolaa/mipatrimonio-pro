import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'mpp_session';

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
 
