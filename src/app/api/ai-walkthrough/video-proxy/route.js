import { NextResponse } from "next/server";

/**
 * GET /api/ai-walkthrough/video-proxy?fileId=...
 * Proxies the video from Gemini Files API to the browser.
 * Requires GEMINI_API_KEY.
 */
export async function GET(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("GEMINI_API_KEY is not configured", { status: 500 });
  }

  const { getResolvedUserId } = await import("@/lib/user-resolver");
  const userId = await getResolvedUserId(request);
  
  const { searchParams } = new URL(request.url);
  let fileId = searchParams.get("fileId");

  if (!fileId) {
    return new Response("fileId is required", { status: 400 });
  }

  // Clean up fileId (remove :download or other suffixes if present)
  const rawId = fileId.includes(":") ? fileId.split(":")[0] : fileId;
  console.log(`[Video Proxy] Request for fileId=${fileId} (rawId=${rawId}) by userId=${userId}`);
  
  try {
    // 1. Check file state first using the REST API (Metadata)
    const metaUrl = `https://generativelanguage.googleapis.com/v1beta/files/${rawId}?key=${apiKey}`;
    const metaRes = await fetch(metaUrl);
    
    if (metaRes.ok) {
      const metadata = await metaRes.json();
      console.log(`[Video Proxy] File state for ${rawId}:`, metadata.state);
      
      if (metadata.state === "PROCESSING") {
        return new Response("Video is still being processed by Gemini. Please retry in a few seconds.", { 
          status: 202,
          headers: { "Retry-After": "5" }
        });
      }
      if (metadata.state === "FAILED") {
        return new Response("Video generation failed on Gemini's side", { status: 500 });
      }
    }

    // 2. Try the preferred download URL format (alt=media)
    // For some Veo resources, the path requires :download suffix AND ?alt=media
    const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${rawId}?alt=media&key=${apiKey}`;
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/files/${rawId}:download?alt=media&key=${apiKey}`;
    
    console.log(`[Video Proxy] Attempting download: ${rawId}`);
    
    let res = await fetch(downloadUrl, { redirect: "follow" });
    
    if (!res.ok) {
      console.warn(`[Video Proxy] Primary download failed (${res.status}). Trying fallback with :download suffix...`);
      res = await fetch(fallbackUrl, { redirect: "follow" });
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Video Proxy] Gemini Download Error (${res.status}):`, errorText);
      return new Response(`Failed to fetch video from Gemini: ${res.statusText}. Error: ${errorText}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "video/mp4";
    const contentLength = res.headers.get("content-length");

    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Video Proxy] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
