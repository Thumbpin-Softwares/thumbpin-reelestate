import { NextResponse } from "next/server";

// Protect all /dashboard/* routes — unauthenticated users are redirected to
// /auth/login. Only checks the auth_token cookie's presence (cheap, runs on
// every navigation); actual JWT verification happens server-side against the
// backend via getBackendSession() when the page/API route loads.
export function middleware(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
