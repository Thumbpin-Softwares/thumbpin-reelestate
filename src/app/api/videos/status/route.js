import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Video from "@/models/Video";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("id") || searchParams.get("video_id");

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const video = await Video.findOne({ _id: videoId, userId: session.user.id });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Normalize status names for frontend consistency if needed
    // Map "ready" to "completed" if frontend expects "completed"
    const responseData = {
      ...video.toObject(),
      status: video.status === "ready" ? "completed" : video.status === "error" ? "failed" : video.status,
      video_url: video.videoUrl,
      thumbnail_url: video.thumbnailUrl
    };

    return NextResponse.json({ success: true, video: responseData, status: responseData.status });
  } catch (error) {
    console.error("[Video Status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
