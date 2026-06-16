import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";

/**
 * GET /api/user/videos
 * Returns the user's video assets (type clip/video) for the history page.
 * Supports pagination via ?page=1&limit=20
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      Asset.find({ userId, type: { $in: ["video", "clip"] } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Asset.countDocuments({ userId, type: { $in: ["video", "clip"] } }),
    ]);

    return NextResponse.json({
      success: true,
      videos: videos.map((v) => ({
        id: v._id.toString(),
        name: v.name,
        url: v.url,
        type: v.type,
        metadata: v.metadata || {},
        createdAt: v.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[User Videos API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
