import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";

/**
 * GET /api/user/stats
 * Returns real counts from MongoDB for the dashboard stats cards.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.id;

    const [totalAssets, totalVideos, totalComposites] = await Promise.all([
      Asset.countDocuments({ userId }),
      Asset.countDocuments({ userId, type: { $in: ["video", "clip"] } }),
      Asset.countDocuments({ userId, type: "composite" }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalAssets,
        totalVideos,
        totalComposites,
      },
    });
  } catch (error) {
    console.error("[User Stats API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
