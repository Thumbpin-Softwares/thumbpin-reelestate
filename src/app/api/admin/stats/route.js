import { NextResponse } from "next/server";
import { authedAdminBackendGet } from "@/lib/admin-backend-session";

// Thin proxy to thumbpin-backend's GET /admin/stats.
export async function GET() {
  const { status, data } = await authedAdminBackendGet("/admin/stats");
  return NextResponse.json(data, { status });
}
