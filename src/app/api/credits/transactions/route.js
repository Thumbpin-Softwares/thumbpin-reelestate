import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// GET /api/credits/transactions?limit=&skip=
// Proxies to thumbpin-backend's GET /credits/transactions.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const { status, data } = await authedBackendGet(`/credits/transactions${qs ? `?${qs}` : ""}`);
  return NextResponse.json(data, { status });
}
