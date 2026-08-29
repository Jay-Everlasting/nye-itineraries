import { NextResponse, type NextRequest } from 'next/server';
import { READ_COOKIE, EDIT_COOKIE, verifySession } from '@/lib/auth';

/**
 * Every page is gated here, before any content is served. Because this runs
 * ahead of the (statically prerendered) page, the prerendered HTML is never
 * handed to an unauthenticated visitor.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public: the two login screens, the cron ping, and Next's own assets.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/editor/login') ||
    pathname.startsWith('/api/ping') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const read = await verifySession(req.cookies.get(READ_COOKIE)?.value);
  if (!read) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // /admin additionally needs a live edit session.
  if (pathname.startsWith('/admin')) {
    const edit = await verifySession(req.cookies.get(EDIT_COOKIE)?.value);
    if (!edit) {
      const url = req.nextUrl.clone();
      url.pathname = '/editor/login';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
