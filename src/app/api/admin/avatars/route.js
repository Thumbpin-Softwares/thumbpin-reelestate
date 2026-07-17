import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const ADMIN_COOKIE_NAME = "admin_token";

// Thin proxy to thumbpin-backend's /admin/avatars (see
// thumbpin-backend/src/modules/admin/admin-avatars.*), which now owns the
// actual R2 scan + in-memory cache instead of this route doing a fully
// sequential HEAD-per-object scan on every request.
async function forwardToBackend(request, { method, isMultipart = false }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { search } = new URL(request.url);
  const headers = { Cookie: `${ADMIN_COOKIE_NAME}=${token}` };
  let body;
  if (isMultipart) {
    body = await request.formData();
  } else if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(await request.json().catch(() => ({})));
  }

  const backendRes = await fetch(`${BACKEND_URL}/api/v1/admin/avatars${search}`, {
    method,
    headers,
    body,
    cache: "no-store",
  });
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

export async function GET(request) {
  return forwardToBackend(request, { method: "GET" });
}

export async function POST(request) {
  return forwardToBackend(request, { method: "POST", isMultipart: true });
}

export async function PATCH(request) {
  return forwardToBackend(request, { method: "PATCH" });
}

export async function DELETE(request) {
  return forwardToBackend(request, { method: "DELETE" });
}
