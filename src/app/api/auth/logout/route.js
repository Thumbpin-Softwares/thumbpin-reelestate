import { NextResponse } from "next/server";
import { proxyToBackend, withForwardedCookies } from "@/lib/backend-proxy";

export async function POST() {
  const { status, data, setCookies } = await proxyToBackend("/auth/logout");
  return withForwardedCookies(NextResponse.json(data, { status }), setCookies);
}
