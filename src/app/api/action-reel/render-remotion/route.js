export const maxDuration = 300;

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Thin SSE pass-through to thumbpin-backend's POST /action-reel/render-remotion.
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
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/action-reel/render-remotion`, {
    method: "POST",
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  if (!backendRes.ok || !backendRes.body) {
    const data = await backendRes.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: backendRes.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
