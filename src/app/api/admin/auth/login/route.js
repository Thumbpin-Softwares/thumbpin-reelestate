import { NextResponse } from "next/server";
import { proxyToBackend, withForwardedCookies } from "@/lib/backend-proxy";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { status, ok, data, setCookies } = await proxyToBackend("/admin/auth/login", {
    method: "POST",
    body,
  });

  if (!ok) {
    return NextResponse.json({ error: data.error || "Invalid credentials" }, { status });
  }

  return withForwardedCookies(NextResponse.json({ success: true }), setCookies);
}
