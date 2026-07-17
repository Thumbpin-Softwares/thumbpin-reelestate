import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Thin proxy to thumbpin-backend's POST /model-tour/upload/avatar.
export async function POST(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await request.formData();
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/model-tour/upload/avatar`, {
    method: "POST",
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    body: formData,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
