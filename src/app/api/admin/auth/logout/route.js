import { NextResponse } from "next/server";
import { proxyToBackend, withForwardedCookies } from "@/lib/backend-proxy";

export async function POST() {
  const { setCookies } = await proxyToBackend("/admin/auth/logout", { method: "POST" });
  return withForwardedCookies(NextResponse.json({ success: true }), setCookies);
}
