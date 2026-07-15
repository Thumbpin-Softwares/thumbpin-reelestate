import { NextResponse } from "next/server";
import { proxyToBackend, withForwardedCookies } from "@/lib/backend-proxy";

// Consumes the one-time code from the backend's Google OAuth redirect
// (see thumbpin-backend's googleCallback) and mints a same-domain cookie
// for this frontend.
export async function POST(request) {
  const body = await request.json();
  const { status, data, setCookies } = await proxyToBackend("/auth/exchange", { body });
  return withForwardedCookies(NextResponse.json(data, { status }), setCookies);
}
