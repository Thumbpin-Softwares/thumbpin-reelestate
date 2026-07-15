import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { resolveUserFromSession } from "@/lib/user-resolver";
import fs from "fs/promises";
import path from "path";

export async function DELETE(request) {
  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { avatar_id } = await request.json();
    if (!avatar_id) {
      return NextResponse.json({ error: "Avatar ID is required" }, { status: 400 });
    }

    await dbConnect();
    const asset = await Asset.findOne({ _id: avatar_id, userId: user._id.toString() });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // 1. Delete file from local storage if it exists
    if (asset.url.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", asset.url);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn("[Avatar Delete] File not found or couldn't be deleted:", filePath);
      }
    }

    // 2. Delete from MongoDB
    await Asset.deleteOne({ _id: avatar_id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Avatar Delete] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
