import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

/**
 * Server-side only. Calls an authenticated backend GET endpoint by forwarding
 * this app's own auth_token cookie as a raw Cookie header — the browser never
 * has a cookie scoped to the backend's domain (see lib/backend-proxy.js), so
 * every authenticated server-to-server call to the backend has to do this
 * manually rather than relying on fetch's normal cookie jar.
 * Returns { status, ok, data } — data is {} if the response isn't ok/JSON.
 */
export async function authedBackendGet(path) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return { status: 401, ok: false, data: { error: "Not authenticated" } };

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (error) {
    console.error("[backend-session] Failed to reach backend:", error);
    return { status: 502, ok: false, data: { error: "Unable to reach the server" } };
  }
}

/**
 * Server-side only. Resolves the current user via the backend's /auth/me.
 * Returns the backend's user object (password hash already excluded) or null.
 */
export async function getBackendSession() {
  const { ok, data } = await authedBackendGet("/auth/me");
  return ok ? (data.user ?? null) : null;
}
