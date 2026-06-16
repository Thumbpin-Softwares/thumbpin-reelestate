/**
 * Admin Avatar File Serve — GET /api/admin/avatars/file?type=product&name=foo.png
 *
 * Legacy endpoint kept for backward compatibility — redirects to /api/admin/r2?key=...
 * which streams the object directly from Cloudflare R2.
 *
 * Query params:
 *   type  — "product" | "real-estate"
 *   name  — filename (without path)
 */

import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import { s3, BUCKET } from "@/lib/r2";
import path from "path";

export async function GET(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const name = searchParams.get("name");

  if (!type || !name) {
    return new NextResponse("Missing params", { status: 400 });
  }

  // Build R2 key from legacy params
  const safeName = path.basename(name); // prevent traversal
  const key =
    type === "real-estate" ? `Avatars/RE/${safeName}` : `Avatars/${safeName}`;

  try {
    const resp = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const body = await resp.Body.transformToByteArray();

    return new NextResponse(body, {
      headers: {
        "Content-Type": resp.ContentType ?? "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[Avatar File] R2 error:", err);
    return new NextResponse("Not found", { status: 404 });
  }
}
