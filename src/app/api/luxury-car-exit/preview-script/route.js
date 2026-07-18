import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Thin proxy to thumbpin-backend's POST /seedance-reel/preview-script.
// Response body is raw audio bytes (audio/mpeg or audio/wav), not JSON —
// passed through as-is rather than parsed.
export async function POST(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.text();
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/seedance-reel/preview-script`, {
    method: "POST",
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  if (!backendRes.ok) {
    const data = await backendRes.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: backendRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(backendRes.body, {
    status: 200,
    headers: {
      "Content-Type": backendRes.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
