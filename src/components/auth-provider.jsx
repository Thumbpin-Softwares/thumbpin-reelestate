"use client";

import { AuthProvider as BackendAuthProvider } from "@/lib/auth-client";

export function AuthProvider({ children }) {
  return <BackendAuthProvider>{children}</BackendAuthProvider>;
}
