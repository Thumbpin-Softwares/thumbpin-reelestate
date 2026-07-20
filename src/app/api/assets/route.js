import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Belt-and-suspenders against any CDN/edge/browser layer caching this
// per-user response by URL alone (query params like `?page=1&limit=24` are
// identical across every user, so a cache that ignores the Cookie header
// would serve user A's asset list to user B).
export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, must-revalidate" };

async function authHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return { Cookie: `${AUTH_COOKIE_NAME}=${token}` };
}

// Thin proxy to thumbpin-backend's GET/PATCH/DELETE /assets.
export async function GET(request) {
  const headers = await authHeaders();
  if (!headers) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS },
    });
  }

  const { search } = new URL(request.url);
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/assets${search}`, {
    headers,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS },
  });
}

export async function PATCH(request) {
  const headers = await authHeaders();
  if (!headers) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { search } = new URL(request.url);
  const body = await request.text();
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/assets${search}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(request) {
  const headers = await authHeaders();
  if (!headers) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { search } = new URL(request.url);
  const body = await request.text();
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/assets${search}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
