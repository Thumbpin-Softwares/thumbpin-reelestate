import { NextResponse } from "next/server";
import { getAssetUrl } from "@/lib/r2";

/**
 * GET /api/r2?key=users/{userId}/...
 *
 * Auth-checks ownership, then redirects to a presigned R2 URL (or CDN URL for
 * public assets). The client fetches bytes directly from Cloudflare edge —
 * no proxying through Vercel.
 */
export async function GET(request) {
  try {
    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedUserId = user._id.toString();

    const { searchParams } = new URL(request.url);
    const encodedKey = searchParams.get("key");

    if (!encodedKey) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const key = decodeURIComponent(encodedKey);

    const isPublic = key.startsWith("Avatars/");
    const ownedPrefix = `users/${resolvedUserId}/`;

    if (!isPublic && !key.startsWith(ownedPrefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = await getAssetUrl(key);
    return NextResponse.redirect(url, { status: 307 });
  } catch (error) {
    console.error("[R2] Error:", error);
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to retrieve asset" }, { status: 500 });
  }
}
