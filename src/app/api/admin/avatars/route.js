/**
 * Admin Avatars API — /api/admin/avatars
 *
 * GET    → list all avatar objects from R2 (Avatars/ prefix, split into product & real-estate)
 * DELETE → delete an avatar from R2
 *
 * R2 folder structure:
 *   Avatars/          → product avatars
 *   Avatars/RE/       → real-estate avatars
 */

import {
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import { s3, BUCKET } from "@/lib/r2";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function isImage(key) {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

function keyToAvatarObj(key, type) {
  const filename = key.split("/").pop();
  return {
    id: `${type}-${filename}`,
    filename,
    key,  // full R2 key
    type,
    url: `/api/admin/r2?key=${encodeURIComponent(key)}`,
    displayName: filename.replace(/\.[^/.]+$/, ""),
  };
}

async function listPrefix(prefix) {
  const items = [];
  let continuationToken;

  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of resp.Contents ?? []) {
      if (isImage(obj.Key)) {
        items.push(obj.Key);
      }
    }

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : null;
  } while (continuationToken);

  return items;
}

// ─── GET /api/admin/avatars ───────────────────────────────────────────────────

export async function GET() {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // List both prefixes in parallel
    const [allKeys, reKeys] = await Promise.all([
      listPrefix("Avatars/"),
      listPrefix("Avatars/RE/"),
    ]);

    // RE keys are a subset of allKeys, so separate them
    const reKeySet = new Set(reKeys);

    const realEstateAvatars = reKeys.map((k) => keyToAvatarObj(k, "real-estate"));

    // Product avatars = Avatars/ keys that are NOT inside Avatars/RE/
    const productAvatars = allKeys
      .filter((k) => !reKeySet.has(k))
      .map((k) => keyToAvatarObj(k, "product"));

    return NextResponse.json({
      product: productAvatars,
      realEstate: realEstateAvatars,
      total: productAvatars.length + realEstateAvatars.length,
    });
  } catch (err) {
    console.error("[Avatars GET] R2 error:", err);
    return NextResponse.json({ error: "Failed to list avatars" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/avatars ────────────────────────────────────────────────

export async function DELETE(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Accept either { key } (full R2 key) or legacy { type, filename }
    let key = body.key;
    if (!key && body.type && body.filename) {
      const safeName = body.filename.replace(/[/\\]/g, "");
      key =
        body.type === "real-estate"
          ? `Avatars/RE/${safeName}`
          : `Avatars/${safeName}`;
    }

    if (!key) {
      return NextResponse.json(
        { error: "key (or type + filename) required" },
        { status: 400 }
      );
    }

    // Security: key must stay inside Avatars/
    if (!key.startsWith("Avatars/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return NextResponse.json({ success: true, deleted: key });
  } catch (err) {
    console.error("[Avatars DELETE] R2 error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
