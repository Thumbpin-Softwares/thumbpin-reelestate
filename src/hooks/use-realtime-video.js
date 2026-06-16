"use client";

import { useEffect, useState } from "react";

/**
 * Hook to track video status via polling.
 * Replaces Supabase Realtime subscription.
 */
export function useRealtimeVideo(videoId) {
  const [video, setVideo] = useState(null);

  useEffect(() => {
    if (!videoId) return;

    let interval;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/videos/status?id=${videoId}`);
        const data = await res.json();
        
        if (res.ok && data.video) {
          setVideo(data.video);
          
          // Stop polling if video is completed or failed
          if (data.video.status === "completed" || data.video.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error("[useRealtimeVideo] Polling error:", error);
      }
    }

    // Initial check
    checkStatus();

    // Start polling every 3 seconds
    interval = setInterval(checkStatus, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoId]);

  return { video };
}
