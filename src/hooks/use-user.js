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
 * All data comes from MongoDB via /api/user/profile.
 */
export function useUser() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (status === "authenticated" && session?.user?.id) {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
        } else {
          // fallback to session data only
          setProfile({
            ...session.user,
            credits: 0,
            plan: "free",
          });
        }
      } catch (error) {
        console.error("[useUser] Error fetching profile:", error);
        setProfile({
          ...session.user,
          credits: 0,
          plan: "free",
        });
      } finally {
        setLoadingProfile(false);
      }
    } else if (status === "unauthenticated") {
      setProfile(null);
      setLoadingProfile(false);
    }
  }, [session, status]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Instant updates: refetch the moment another part of the app reports a
  // credit change, plus whenever the tab regains focus.
  useEffect(() => {
    window.addEventListener(CREDITS_CHANGED_EVENT, fetchProfile);
    window.addEventListener("focus", fetchProfile);
    return () => {
      window.removeEventListener(CREDITS_CHANGED_EVENT, fetchProfile);
      window.removeEventListener("focus", fetchProfile);
    };
  }, [fetchProfile]);

  const isLoading = status === "loading" || loadingProfile;

  return {
    user: session?.user || null,
    profile,
    loading: isLoading,
    credits: profile?.credits ?? 0,
    status,
    refetch: fetchProfile,
  };
}
