import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "@/lib/r2";

/**
 * GET /api/r2/user?key=users/{userId}/...
 *
 * User-scoped R2 proxy. Validates:
 *  1. The user is authenticated.
 *  2. The requested key is strictly owned by the session user
 *     (key must start with "users/{session.user.id}/").
 *
 * This prevents any user from accessing another user's assets
 * even if they know the exact R2 key.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    const ownedPrefix = `users/${session.user.id}/`;
    if (!key.startsWith(ownedPrefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Fetch from R2 ─────────────────────────────────────────────────────────
    const response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );

    const contentType = response.ContentType || "application/octet-stream";
    const body = response.Body;

    if (!body) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const chunks = [];
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    console.error("[R2 User Proxy] Error:", error);
    return NextResponse.json({ error: "Failed to retrieve asset" }, { status: 500 });
  }
}
