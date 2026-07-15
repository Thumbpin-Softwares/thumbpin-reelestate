const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

/**
 * Server-side only. Calls the backend over a normal server-to-server fetch
 * (no CORS/cookie restrictions apply there) and hands back any Set-Cookie
 * headers it returned, so the caller can re-issue them as its own
 * same-domain cookies — this is what lets the frontend's Next.js server see
 * a session even though the backend lives on a different registrable
 * domain and the browser will never forward its cookie here directly.
 */
export async function proxyToBackend(path, { method = "POST", body } = {}) {
  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, setCookies };
}

export function withForwardedCookies(nextResponse, setCookies) {
  for (const cookie of setCookies) {
    nextResponse.headers.append("Set-Cookie", cookie);
  }
  return nextResponse;
}
