import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Video from "@/models/Video";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";

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
    const isCompleted = info.status === "completed";

    // Update DB if completed
    try {
      if (isCompleted && info.video_url) {
        const session = await getServerSession(authOptions);
        if (session) {
          await dbConnect();
          
          // Update Video record
          const videoRecord = await Video.findOneAndUpdate(
            { video_id: video_id },
            { 
              status: "completed", 
              videoUrl: info.video_url,
              thumbnailUrl: info.thumbnail_url 
            },
            { new: true }
          );

          // Create Asset record if it doesn't exist
          const existingAsset = await Asset.findOne({ 
            userId: session.user.id,
            "metadata.video_id": video_id 
          });

          if (!existingAsset && videoRecord) {
            await Asset.create({
              userId: session.user.id,
              name: `Generated Video - ${new Date().toLocaleDateString()}`,
              url: info.video_url,
              type: "video",
              metadata: {
                video_id: video_id,
                thumbnail_url: info.thumbnail_url,
                source: "heygen",
                aspect_ratio: videoRecord.metadata?.get("aspect_ratio")
              }
            });
            console.log("[RE Status] Created asset for video:", video_id);
          }
        }
      }
    } catch (dbErr) {
      console.error("[RE Status] DB Update error:", dbErr);
    }

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
