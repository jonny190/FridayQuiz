import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for non-dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const session = request.cookies.get("next-auth.session-token")?.value;

  if (!session) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all route paths except:
     * - API routes
     * - Static files
     * - Root path
     * - Auth pages
     */
    "/((?!api|_next/static|_next/image|favicon.ico|auth|assets|.*\\..*).*)",
  ],
};
