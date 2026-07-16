"use client";

import { useSession } from "@/lib/auth-client";
import { useCallback, useEffect, useState } from "react";

// Fired anywhere in the app right after an action that changes the user's
// credit balance (e.g. a generation completing), so every mounted useUser()
// instance can refetch immediately instead of waiting on the poll interval.
export const CREDITS_CHANGED_EVENT = "credits:changed";

export function notifyCreditsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
  }
}

/**
 * Hook to get the current authenticated user and their profile details.
 * Identity (name/email/image/createdAt) comes from the session, which is
 * itself backed by thumbpin-backend's /auth/me (see lib/backend-session.js).
 * Credits/plan/free-quota come from thumbpin-backend's dedicated credits
 * module (/api/credits/me -> backend's /credits/me) — the same live Mongo
 * row as the session, just read through the module that owns balance logic.
 */
export function useUser() {
  const { data: session, status } = useSession();
  const [credits, setCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (status === "authenticated" && session?.user?.id) {
      try {
        const res = await fetch("/api/credits/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCredits({ credits: data.credits, plan: data.plan, freeQuota: data.freeQuota });
        } else {
          setCredits({ credits: 0, plan: "free", freeQuota: null });
        }
      } catch (error) {
        console.error("[useUser] Error fetching credits:", error);
        setCredits({ credits: 0, plan: "free", freeQuota: null });
      } finally {
        setLoadingCredits(false);
      }
    } else if (status === "unauthenticated") {
      setCredits(null);
      setLoadingCredits(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Instant updates: refetch the moment another part of the app reports a
  // credit change, plus whenever the tab regains focus.
  useEffect(() => {
    window.addEventListener(CREDITS_CHANGED_EVENT, fetchCredits);
    window.addEventListener("focus", fetchCredits);
    return () => {
      window.removeEventListener(CREDITS_CHANGED_EVENT, fetchCredits);
      window.removeEventListener("focus", fetchCredits);
    };
  }, [fetchCredits]);

  const isLoading = status === "loading" || loadingCredits;

  // `profile` keeps the same merged shape earlier code already relies on
  // (name/email/image/createdAt from session + credits/plan/free-quota
  // counts from the credits module) so existing consumers don't need to
  // change how they read it.
  const profile = session?.user
    ? {
        ...session.user,
        credits: credits?.credits ?? 0,
        plan: credits?.plan ?? "free",
        freeVideoGenerationsUsed: credits?.freeQuota?.video?.used ?? session.user.freeVideoGenerationsUsed ?? 0,
        freeAvatarGenerationsUsed: credits?.freeQuota?.avatar?.used ?? session.user.freeAvatarGenerationsUsed ?? 0,
      }
    : null;

  return {
    user: session?.user || null,
    profile,
    loading: isLoading,
    credits: credits?.credits ?? 0,
    freeQuota: credits?.freeQuota ?? null,
    status,
    refetch: fetchCredits,
  };
}
