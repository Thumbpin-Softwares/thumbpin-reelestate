/**
 * Public Real-Estate Avatars API — GET /api/avatars/re
 *
 * Returns the list of available real-estate presenter avatars stored
 * in Cloudflare R2 under the Avatars/RE/ prefix. No auth required —
 * these are shown to all logged-in users on the AI Walkthrough page.
 *
 * Response: { avatars: [{ id, name, url, key }] }
 * url → /api/admin/r2?key=Avatars/RE/<filename>  (served via admin R2 route)
 */

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { s3, BUCKET } from "@/lib/r2";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const RE_PREFIX = "Avatars/RE/";

function isImage(key) {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return false;
  return IMAGE_EXTS.has(key.slice(dot).toLowerCase());
}

export async function GET() {
  try {
    const avatars = [];
    let continuationToken;
    let index = 1;

    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: RE_PREFIX,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of resp.Contents ?? []) {
        if (!isImage(obj.Key)) continue;

        const filename = obj.Key.slice(RE_PREFIX.length); // e.g. "agent1.png"
        const displayName = filename.replace(/\.[^/.]+$/, ""); // strip extension

        avatars.push({
          id: `re-${filename}`,
          name: `RE Agent ${index++}`,
          displayName,
          key: obj.Key,
          // Serve via the admin R2 route which streams directly from R2
          url: `/api/admin/r2?key=${encodeURIComponent(obj.Key)}`,
          lastModified: obj.LastModified,
        });
      }

      continuationToken = resp.IsTruncated ? resp.NextContinuationToken : null;
    } while (continuationToken);

    return NextResponse.json({ avatars }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[Public RE Avatars] R2 error:", err);
    return NextResponse.json({ error: "Failed to load avatars", avatars: [] }, { status: 500 });
  }
}
