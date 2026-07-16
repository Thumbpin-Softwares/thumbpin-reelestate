import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// GET /api/credits/me — proxies to thumbpin-backend's GET /credits/me
// (the credits module's own balance + plan + free-quota snapshot, as
// opposed to /api/auth/session's full profile doc).
export async function GET() {
  const { status, data } = await authedBackendGet("/credits/me");
  return NextResponse.json(data, { status });
}
