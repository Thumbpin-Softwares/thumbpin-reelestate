import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { getResolvedUserId } from "@/lib/user-resolver";
import { uploadToR2, buildUserKey, extFromMime } from "@/lib/r2-upload";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request) {
  try {
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name") || "Untitled Asset";
    const type = formData.get("type") || "general";
    const category = formData.get("category") || "uploads";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // ── Upload to R2 ──────────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extFromMime(file.type) || "bin";
    const key = buildUserKey(userId, category, ext, category);
    const url = await uploadToR2(buffer, key, file.type);

    // ── Save metadata to MongoDB ──────────────────────────────────────────────
    await dbConnect();
    const asset = await Asset.create({
      userId,
      name: name.trim().substring(0, 100),
      url,
      type,
      metadata: {
        is_custom: true,
        r2Key: key,
        originalName: file.name || "",
      },
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("[Asset Upload] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
