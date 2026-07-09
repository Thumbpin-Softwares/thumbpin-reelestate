"use client";

import { useEffect, useRef } from "react";
import { appNotify } from "@/modules/common/components/notification";

// navigator.onLine only reflects "has a network interface", not "can
// actually reach the internet" (e.g. connected to wifi with no upstream) —
// a real fetch is the only reliable check.
async function isReallyOnline() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
    return true;
  } catch (_) {
    return false;
  }
}

// Mounted once at the root layout — shows a persistent warning toast
// (same look as appNotify.warning, stays until dismissed) whenever the
// browser loses connectivity, with a Retry action, and auto-dismisses the
// moment the connection actually comes back.
export function NetworkStatus() {
  const toastId = useRef(null);

  useEffect(() => {
    function dismissOfflineToast() {
      if (toastId.current) {
        appNotify.dismiss(toastId.current);
        toastId.current = null;
      }
    }

    async function handleRetry() {
      const online = await isReallyOnline();
      if (online) {
        dismissOfflineToast();
        appNotify.success("Back online");
      } else {
        appNotify.warning("Still offline", {
          description: "Check your internet connection and try again.",
        });
      }
    }

    function showOfflineToast() {
      if (toastId.current) return; // already showing
      toastId.current = appNotify.warning("Connection lost", {
        description: "Check your internet connection and try again.",
        duration: Infinity,
        action: { label: "Retry", onClick: handleRetry },
      });
    }

    function handleOffline() {
      showOfflineToast();
    }

    async function handleOnline() {
      const online = await isReallyOnline();
      if (online) {
        dismissOfflineToast();
        appNotify.success("Back online");
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showOfflineToast();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
