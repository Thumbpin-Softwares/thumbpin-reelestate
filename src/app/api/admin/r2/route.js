/**
 * Admin R2 CRUD API — /api/admin/r2
 *
 * GET    ?prefix=Avatars/     → list objects under a prefix
 * GET    ?key=Avatars/foo.png → stream a single object
 * POST   multipart (file, key) → upload to R2
 * PUT    { oldKey, newKey }   → rename/move (copy + delete)
 * DELETE { key }              → delete an object
 *
 * All routes require a valid admin session.
 */

import {
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import { s3, BUCKET } from "@/lib/r2";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const prefix = searchParams.get("prefix") ?? "";

  // 1. Allow public access to Avatars via GET
  const isPublicAvatar = key && key.startsWith("Avatars/");

  if (!isPublicAvatar) {
    const session = await verifyAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Stream a single object
  if (key) {
    try {
      const resp = await s3.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: key })
      );
      const body = await resp.Body.transformToByteArray();
      return new Response(body, {
        headers: {
          "Content-Type": resp.ContentType ?? "application/octet-stream",
          "Content-Length": resp.ContentLength?.toString() ?? "",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      console.error("[R2 GET] single object error:", err);
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }
  }

  // List objects under prefix
  try {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        Delimiter: "/",    // treat prefixes as virtual folders
      })
    );

    const objects = (list.Contents ?? []).map((obj) => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      url: `/api/admin/r2?key=${encodeURIComponent(obj.Key)}`,
    }));

    const folders = (list.CommonPrefixes ?? []).map((p) => ({
      prefix: p.Prefix,
    }));

    return NextResponse.json({ objects, folders, prefix });
  } catch (err) {
    console.error("[R2 GET] list error:", err);
    return NextResponse.json({ error: "Failed to list objects" }, { status: 500 });
  }
}

// ─── POST (Upload) ────────────────────────────────────────────────────────────

export async function POST(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    // key can be a full path like "Avatars/RE/my-avatar.png"
    const key = formData.get("key") ?? file?.name;

    if (!file || !key) {
      return NextResponse.json(
        { error: "file and key are required" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: Buffer.from(bytes),
        ContentType: file.type || "application/octet-stream",
      })
    );

    return NextResponse.json({
      success: true,
      key,
      url: `/api/admin/r2?key=${encodeURIComponent(key)}`,
    });
  } catch (err) {
    console.error("[R2 POST] upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ─── PUT (Rename / Move) ──────────────────────────────────────────────────────

export async function PUT(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { oldKey, newKey } = await request.json();

    if (!oldKey || !newKey) {
      return NextResponse.json(
        { error: "oldKey and newKey are required" },
        { status: 400 }
      );
    }

    if (oldKey === newKey) {
      return NextResponse.json({ success: true, key: newKey });
    }

    // Copy to new key
    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${oldKey}`,
        Key: newKey,
      })
    );

    // Delete old key
    await s3.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey })
    );

    return NextResponse.json({
      success: true,
      oldKey,
      key: newKey,
      url: `/api/admin/r2?key=${encodeURIComponent(newKey)}`,
    });
  } catch (err) {
    console.error("[R2 PUT] rename error:", err);
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

    return NextResponse.json({ success: true, deleted: key });
  } catch (err) {
    console.error("[R2 DELETE] error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
