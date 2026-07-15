"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const AuthContext = createContext(null);

// Backed by thumbpin-backend's cookie auth instead of NextAuth. Keeps the
// same { data: session, status } / signIn / signOut shape as next-auth/react
// so existing call sites don't need to change beyond the import path.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ user, status, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used within an AuthProvider");
  // `refetch` is an extension beyond next-auth/react's shape — used right
  // after signIn()/register so the UI reflects the new session immediately
  // instead of waiting for the next natural remount.
  return { data: ctx.user ? { user: ctx.user } : null, status: ctx.status, refetch: ctx.refetch };
}

export async function signIn(provider, options = {}) {
  if (provider === "google") {
    // Full-page navigation, not a fetch — Google needs to redirect the
    // browser itself through the backend's OAuth flow. The backend then
    // redirects back to this app's /auth/callback with a one-time code
    // (see thumbpin-backend's googleCallback + this app's /auth/callback).
    window.location.href = `${BACKEND_URL}/api/v1/auth/google`;
    return;
  }

  // "credentials" — goes through this app's own /api/auth/login proxy
  // (same-origin) so the session cookie ends up on this app's own domain,
  // not the backend's. See lib/backend-proxy.js for why.
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: options.email, password: options.password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "Invalid email or password", ok: false };
    }
    return { error: null, ok: true };
  } catch {
    return { error: "Unable to reach the server", ok: false };
  }
}

export async function signOut(options = {}) {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore — we still want to clear local state and redirect below.
  }
  if (typeof window !== "undefined") {
    window.location.href = options.callbackUrl || "/";
  }
}
