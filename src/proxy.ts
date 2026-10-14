import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_SECRET } from '@/lib/env';
import { hmacHex, safeEqual } from '@/lib/ids';

/**
 * Next 16 renamed middleware to "proxy". It runs on the Node.js runtime, but
 * the docs are clear that this is only an optimistic check: every page and
 * server action re-checks the session and role in the data layer.
 *
 * Here it only verifies that a *validly signed* session cookie exists, which
 * avoids a database round trip on static assets and marketing pages.
 */

function hasSignedSession(request: NextRequest): boolean {
  const signed = request.cookies.get(SESSION_COOKIE)?.value;
  if (!signed) return false;
  const index = signed.lastIndexOf('.');
  if (index <= 0) return false;
  const raw = signed.slice(0, index);
  const signature = signed.slice(index + 1);
  return safeEqual(signature, hmacHex(SESSION_SECRET, raw));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (hasSignedSession(request)) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/dashboard',
    '/notifications',
    '/learn/:path*',
    '/admin/:path*',
  ],
};
