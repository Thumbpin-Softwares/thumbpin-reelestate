"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

// Lands here after Google OAuth: the backend redirects with a one-time
// handoff code (see thumbpin-backend's googleCallback) because it lives on
// a different domain and can't set a cookie this app's server can read.
// We trade that code for a session via /api/auth/exchange, which mints a
// cookie on this app's own domain.
function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useSession();
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get("code");
    if (!code) {
      router.replace("/auth/login?error=google_oauth_failed");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          setError("Sign-in failed or expired. Please try again.");
          setTimeout(() => router.replace("/auth/login?error=google_oauth_failed"), 1500);
          return;
        }
        await refetch();
        router.replace("/dashboard");
      } catch {
        setError("Unable to reach the server.");
        setTimeout(() => router.replace("/auth/login?error=google_oauth_failed"), 1500);
      }
    })();
  }, [searchParams, router, refetch]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#fafbfc]">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Finishing sign-in...</p>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fafbfc]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthCallback />
    </Suspense>
  );
}
