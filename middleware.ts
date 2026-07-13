import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PAM_HOSTNAMES = new Set(['pam.polynize.ai', 'pam.localhost']);

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const { pathname } = request.nextUrl;
  const isPam = PAM_HOSTNAMES.has(host);

  let response: NextResponse;

  if (isPam && !pathname.startsWith('/console')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/console' : `/console${pathname}`;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  // Hard cache-disable for every /console route (and every pam.polynize.ai
  // request, since middleware rewrites it to /console). The Console depends
  // on flash cookies that change between requests; any cache layer holding
  // a /console response stale breaks the sign-in confirmation card flow.
  // We already tried (Step 7A.6): dynamic='force-dynamic' on layout +
  // revalidatePath('/console','layout') after each action. The user could
  // still reproduce by signing in then NOT seeing the confirmation card
  // until hard-refresh — exact signature of a cache layer that ignores
  // Next.js's dynamic-rendering signals. These headers are belt + braces:
  //  - Cache-Control: no-store — Vercel edge + browser HTTP cache
  //  - Pragma: no-cache — legacy HTTP/1.0 fallback
  // Together they also disable browser bfcache (per HTML spec, no-store
  // pages are ineligible for bfcache).
  if (isPam || pathname.startsWith('/console')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  // The trailing `.*\\..*` exclusion keeps static PUBLIC files (avatars, images,
  // robots.txt: any path whose last segment has an extension) out of the
  // middleware entirely: on pam.polynize.ai they must be served as-is, not
  // rewritten to /console/<file> (which 404s, the broken-avatars bug).
  // App routes never contain dots, so no page loses the rewrite/cache headers.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
