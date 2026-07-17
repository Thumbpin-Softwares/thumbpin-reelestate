import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// GET /api/avatars/re — thin SSE pass-through to thumbpin-backend's
// /avatars/re (see thumbpin-backend/src/modules/re-avatars), which now owns
// the actual R2 scan + in-memory cache + progressive streaming. This route
// used to do all of that itself (list+HEAD+manifest-fetch straight from R2
// on every request, no cache) — moved backend-side so it can read req.user
// directly from its own requireAuth instead of paying an extra auth
// round-trip, and so the shared/prebuilt library it scans can be cached
// once for every user instead of rescanned per request.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const backendRes = await fetch(`${BACKEND_URL}/api/v1/avatars/re`, {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    cache: "no-store",
  });

  if (!backendRes.ok || !backendRes.body) {
    return new Response(JSON.stringify({ error: "Failed to reach backend" }), {
      status: backendRes.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pipe the backend's SSE stream straight through — no buffering, no
  // re-parsing, so the progressive one-card-at-a-time behavior survives
  // the extra hop.
  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
