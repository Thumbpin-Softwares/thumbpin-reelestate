import { NextResponse } from "next/server";

/**
 * GET /api/real-estate-video/status?video_id=...
 * Polls HeyGen for the video render status.
 * Returns { status, video_url, thumbnail_url }
 */
export async function GET(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const video_id = searchParams.get("video_id");

  if (!video_id) {
    return NextResponse.json({ error: "video_id is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${video_id}`,
      {
        headers: { "X-Api-Key": apiKey },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Failed to get video status" },
        { status: response.status }
      );
    }

    const info = data.data || data;

    return NextResponse.json({
      video_id,
      status: info.status || "processing",
      video_url: info.video_url || null,
      thumbnail_url: info.thumbnail_url || null,
      duration: info.duration || null,
    });
  } catch (error) {
    console.error("[RE Status] Error:", error);
    return NextResponse.json({ error: error.message || "Status check failed" }, { status: 500 });
  }
}
