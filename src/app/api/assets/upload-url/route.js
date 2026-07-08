import { NextResponse } from "next/server";
import { getResolvedUserId } from "@/lib/user-resolver";
import { getPresignedUploadUrl, buildUserKey, extFromMime } from "@/lib/r2-upload";
import { R2_PUBLIC_URL } from "@/lib/r2";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * POST /api/assets/upload-url
 *
 * Step 1 of the direct-to-R2 upload flow: the client asks for a presigned PUT
 * URL (tiny JSON request/response, no file bytes involved) instead of sending
 * the file itself through this serverless function, which — on Vercel — would
 * hit the platform's 4.5MB request body cap. The client PUTs the file straight
 * to the returned URL, then calls /api/assets/confirm to persist the Asset doc.
 */
export async function POST(request) {
  try {
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contentType, fileSize, category = "uploads" } = await request.json();

    if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${contentType}` },
        { status: 400 }
      );
    }

    if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }

    const ext = extFromMime(contentType) || "bin";
    const key = buildUserKey(userId, category, ext, category);
    const uploadUrl = await getPresignedUploadUrl(key, contentType);
    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/api/r2?key=${encodeURIComponent(key)}`;

    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (error) {
    console.error("[Asset Upload URL] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
