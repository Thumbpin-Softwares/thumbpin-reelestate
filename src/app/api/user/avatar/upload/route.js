import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import { resolveUserFromSession } from "@/lib/user-resolver";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { uploadToR2, buildUserKey, extFromMime } from "@/lib/r2-upload";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Content-Length header before reading the body
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
    }

    await dbConnect();
    const resolvedUser = await resolveUserFromSession();
    const userId = resolvedUser?._id?.toString() ?? session.user.id;

    let formData;
    try {
      formData = await req.formData();
    } catch (err) {
      if (err?.message?.toLowerCase().includes("too large") || err?.code === "LIMIT_FILE_SIZE") {
        return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
      }
      throw err;
    }

    const file = formData.get("avatar");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const contentType = file.type;
    if (!ALLOWED_MIME.has(contentType)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, or WebP images are allowed" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
    }

    const ext = extFromMime(contentType);
    const key = buildUserKey(userId, "avatars", ext, "avatar");
    const url = await uploadToR2(buffer, key, contentType);

    await User.findByIdAndUpdate(userId, { image: url });

    return NextResponse.json({ success: true, url });
  } catch (err) {
    console.error("[Avatar Upload] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
