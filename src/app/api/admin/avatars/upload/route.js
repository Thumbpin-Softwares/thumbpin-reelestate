/**
 * Admin Avatar Upload — POST /api/admin/avatars/upload
 *
 * Accepts multipart form with:
 *   file   — image file (PNG, JPG, WEBP)
 *   type   — "product" | "real-estate"
 *   name   — optional custom filename (without extension)
 *
 * Uploads directly to Cloudflare R2:
 *   product      → Avatars/<filename>
 *   real-estate  → Avatars/RE/<filename>
 */

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import { s3, BUCKET } from "@/lib/r2";
import path from "path";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);

export async function POST(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type");       // "product" | "real-estate"
    const customName = formData.get("name"); // optional

    if (!file || !type) {
      return NextResponse.json(
        { error: "file and type are required" },
        { status: 400 }
      );
    }

    if (!["product", "real-estate"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'product' or 'real-estate'" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPG, WEBP images are allowed" },
        { status: 400 }
      );
    }

    // Build a safe filename
    const ext = path.extname(file.name) || ".png";
    const baseName = customName
      ? `${customName.replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}`
      : file.name.replace(/[^a-zA-Z0-9_.\-]/g, "_");
    const safeName = path.basename(baseName);

    // R2 key
    const key =
      type === "real-estate" ? `Avatars/RE/${safeName}` : `Avatars/${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    return NextResponse.json({
      success: true,
      filename: safeName,
      key,
      type,
      url: `/api/admin/r2?key=${encodeURIComponent(key)}`,
    });
  } catch (err) {
    console.error("[Avatar Upload] R2 error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
