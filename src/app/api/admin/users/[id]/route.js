import { NextResponse } from "next/server";
import { authedAdminBackendRequest } from "@/lib/admin-backend-session";

// Thin proxy to thumbpin-backend's PATCH/DELETE /admin/users/:id.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status, data } = await authedAdminBackendRequest(`/admin/users/${id}`, { method: "PATCH", body });
  return NextResponse.json(data, { status });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { status, data } = await authedAdminBackendRequest(`/admin/users/${id}`, { method: "DELETE" });
  return NextResponse.json(data, { status });
}
