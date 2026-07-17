import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const ADMIN_COOKIE_NAME = "admin_token";

/**
 * Server-side only. Mirrors lib/backend-session.js but for the separate
 * admin_token cookie/secret — forwards it as a raw Cookie header since the
 * browser never has a cookie scoped to the backend's own domain.
 */
export async function authedAdminBackendGet(path) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return { status: 401, ok: false, data: { error: "Not authenticated" } };

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      headers: { Cookie: `${ADMIN_COOKIE_NAME}=${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (error) {
    console.error("[admin-backend-session] Failed to reach backend:", error);
    return { status: 502, ok: false, data: { error: "Unable to reach the server" } };
  }
}

/**
 * Server-side only. Same as authedAdminBackendGet but for PATCH/DELETE/POST
 * calls that send a JSON body.
 */
export async function authedAdminBackendRequest(path, { method = "POST", body } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return { status: 401, ok: false, data: { error: "Not authenticated" } };

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      method,
      headers: { Cookie: `${ADMIN_COOKIE_NAME}=${token}`, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (error) {
    console.error("[admin-backend-session] Failed to reach backend:", error);
    return { status: 502, ok: false, data: { error: "Unable to reach the server" } };
  }
}

/**
 * Resolves the current admin via the backend's /admin/auth/me, validating
 * the admin_token JWT server-side instead of trusting an unsigned cookie.
 * Returns { email, role } or null.
 */
export async function verifyAdminSession() {
  const { ok, data } = await authedAdminBackendGet("/admin/auth/me");
  return ok ? (data.admin ?? null) : null;
}
