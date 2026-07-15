import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

/**
 * Server-side only. Resolves the current user by forwarding the auth_token
 * cookie to the thumbpin-backend's /auth/me — no shared JWT secret needed
 * on the frontend, the backend is the source of truth.
 * Returns the backend's user object (password hash already excluded) or null.
 */
export async function getBackendSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch (error) {
    console.error("[backend-session] Failed to reach backend:", error);
    return null;
  }
}
