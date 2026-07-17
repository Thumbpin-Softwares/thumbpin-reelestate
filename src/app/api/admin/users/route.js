import { NextResponse } from "next/server";
import { authedAdminBackendGet } from "@/lib/admin-backend-session";

// Thin proxy to thumbpin-backend's GET /admin/users.
export async function GET(request) {
  const { search } = new URL(request.url);
  const { status, data } = await authedAdminBackendGet(`/admin/users${search}`);
  return NextResponse.json(data, { status });
}
