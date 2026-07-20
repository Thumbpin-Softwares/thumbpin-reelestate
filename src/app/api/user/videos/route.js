import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Thin proxy to thumbpin-backend's GET /user/videos.
export async function GET(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { search } = new URL(request.url);
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/user/videos${search}`, {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
