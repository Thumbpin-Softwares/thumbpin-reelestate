import { NextResponse } from "next/server";
import { authedAdminBackendGet, authedAdminBackendRequest } from "@/lib/admin-backend-session";

// Thin proxy to thumbpin-backend's GET/PATCH /admin/users/:id/credits.
export async function GET(request, { params }) {
  const { id } = await params;
  const { status, data } = await authedAdminBackendGet(`/admin/users/${id}/credits`);
  return NextResponse.json(data, { status });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status, data } = await authedAdminBackendRequest(`/admin/users/${id}/credits`, { method: "PATCH", body });
  return NextResponse.json(data, { status });
}
