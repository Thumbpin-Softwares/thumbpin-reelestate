import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Video from "@/models/Video";
import Asset from "@/models/Asset";

export async function GET() {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const [
    totalUsers,
    proUsers,
    totalVideos,
    totalAvatarAssets,
    recentUsers,
    creditStats,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ plan: "pro" }),
    // Videos are stored in Asset (type: "video") AND the Video collection
    Promise.all([
      Asset.countDocuments({ type: "video" }),
      Asset.countDocuments({ type: "composite" }),
      Asset.countDocuments({ type: "clip" }),
      Video.countDocuments().catch(() => 0),
    ]).then(counts => counts.reduce((a, b) => a + b, 0)),
    Asset.countDocuments({ type: "avatar" }),
    User.find().sort({ createdAt: -1 }).limit(5).select("email name createdAt plan credits").lean(),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalCredits: { $sum: "$credits" },
          avgCredits: { $avg: "$credits" },
        },
      },
    ]).catch(() => []),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers,
      freeUsers: totalUsers - proUsers,
      proUsers,
      totalVideos,
      totalAvatarAssets,
      totalCreditsInSystem: creditStats[0]?.totalCredits || 0,
      avgCreditsPerUser: Math.round(creditStats[0]?.avgCredits || 0),
    },
    recentUsers,
  });
}
