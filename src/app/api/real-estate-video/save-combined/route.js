import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getResolvedUserId } from "@/lib/user-resolver";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";

/**
 * POST /api/real-estate-video/save-combined
 * Receives a combined video blob from the client-side FFmpeg WASM combiner,
 * uploads it to Cloudflare R2, and creates an Asset Library entry.
 * Input: FormData with video (file)
 * Output: { url, assetId }
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    // ── User Resolution ──────────────────────────────────────────────────────
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "User resolution failed. Please log in again." }, { status: 401 });
    }

    const formData = await request.formData();
    const videoFile = formData.get("video");

    if (!videoFile || !(videoFile instanceof File)) {
      return NextResponse.json({ error: "video file is required" }, { status: 400 });
    }

    // ── Upload to R2 ──────────────────────────────────────────────────────────
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    const key = buildUserKey(userId, "videos", "mp4", "combined-walkthrough");
    const videoUrl = await uploadToR2(buffer, key, "video/mp4");

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    console.log(`[CombinedVideo] Uploaded to R2: ${key} (${sizeMB} MB)`);

    // ── Create Asset Library entry ────────────────────────────────────────────
    await dbConnect();
    const asset = await Asset.create({
      userId: userId,
      name: `Combined Walkthrough - ${new Date().toLocaleDateString()}`,
      url: videoUrl,
      type: "clip",
      metadata: {
        r2Key: key,
        source: "ffmpeg-wasm",
        context: "real-estate-video-combined",
        fileSize: buffer.length,
      },
    });

    console.log(`[CombinedVideo] Asset created: ${asset._id}`);

    return NextResponse.json({
      url: videoUrl,
      assetId: asset._id.toString(),
    });
  } catch (err) {
    console.error("[CombinedVideo] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save combined video" },
      { status: 500 }
    );
  }
}
