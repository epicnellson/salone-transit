import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/agent/verify")) {
    const session = request.cookies.get("agent_session")?.value;
    if (!session) {
      const loginUrl = new URL("/agent/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/agent/login") {
    const session = request.cookies.get("agent_session")?.value;
    if (session) {
      return NextResponse.redirect(new URL("/agent/verify", request.url));
    }
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = request.cookies.get("admin_session")?.value;
    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/admin/login") {
    const session = request.cookies.get("admin_session")?.value;
    if (session) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/agent/:path*", "/admin/:path*"],
};
