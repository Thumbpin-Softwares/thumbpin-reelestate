import { NextResponse } from "next/server";
import { proxyToBackend, withForwardedCookies } from "@/lib/backend-proxy";

export async function POST(request) {
  const body = await request.json();
  const { status, data, setCookies } = await proxyToBackend("/auth/register", { body });
  return withForwardedCookies(NextResponse.json(data, { status }), setCookies);
}
