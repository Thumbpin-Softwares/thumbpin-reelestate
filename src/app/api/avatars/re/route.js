/**
 * Public Real-Estate Avatars API — GET /api/avatars/re
 *
 * Returns the list of available real-estate presenter avatars stored
 * in Cloudflare R2 under the Avatars/RE/ prefix, grouped by collection.
 * No auth required — these are shown to all logged-in users on the AI Walkthrough page.
 *
 * Response: { avatars: [{ id, name, images: [{url, key, index}], coverImage }] }
 */

import { ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { s3, BUCKET } from "@/lib/r2";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { getResolvedUserId } from "@/lib/user-resolver";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const RE_PREFIX = "Avatars/RE/";

function isImage(key) {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return false;
  return IMAGE_EXTS.has(key.slice(dot).toLowerCase());
}

export async function GET(request) {
  try {
    // 1. Fetch custom avatars for the current authenticated user from MongoDB
    let customAvatars = [];
    try {
      const userId = await getResolvedUserId(request);
      if (userId) {
        await dbConnect();
        const dbAssets = await Asset.find({ userId, type: "avatar" }).sort({ createdAt: -1 });
        customAvatars = dbAssets.map((asset) => ({
          id: asset._id.toString(),
          name: asset.name || "Custom Agent",
          coverImage: asset.url,
          imageCount: 1,
          images: [
            {
              url: asset.url,
              key: asset._id.toString(),
              index: 0,
              displayName: asset.name || "Custom"
            }
          ],
          isCustom: true,
          lastModified: asset.createdAt,
        }));
      }
    } catch (err) {
      console.warn("[RE Avatars] Failed to fetch custom database avatars:", err.message);
    }

    const allObjects = [];
    let continuationToken;

    // List all objects under Avatars/RE/
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
        allObjects.push(obj);
      }

      continuationToken = resp.IsTruncated ? resp.NextContinuationToken : null;
    } while (continuationToken);

    // Fetch metadata for each object to get collection info
    const collectionsMap = new Map();
    const ungrouped = [];

    for (const obj of allObjects) {
      let collectionId = null;
      let collectionName = null;
      let fileIndex = 0;

      try {
        const headResp = await s3.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: obj.Key })
        );
        collectionId = headResp.Metadata?.["collection-id"] || null;
        collectionName = headResp.Metadata?.["collection-name"] || null;
        fileIndex = parseInt(headResp.Metadata?.["file-index"] || "0");
      } catch (err) {
        console.warn(`[RE Avatars] Failed to get metadata for ${obj.Key}:`, err.message);
      }

      const filename = obj.Key.slice(RE_PREFIX.length);
      const displayName = filename.replace(/\.[^/.]+$/, "");
      const imageEntry = {
        url: `/api/r2?key=${encodeURIComponent(obj.Key)}`,
        key: obj.Key,
        index: fileIndex,
        displayName,
      };

      if (collectionId) {
        if (!collectionsMap.has(collectionId)) {
          collectionsMap.set(collectionId, {
            id: collectionId,
            name: collectionName || `RE Agent`,
            images: [],
            lastModified: obj.LastModified,
          });
        }
        collectionsMap.get(collectionId).images.push(imageEntry);
      } else {
        // Legacy avatar without collection metadata — treat as its own collection
        ungrouped.push({
          id: `legacy-${filename}`,
          name: displayName || "RE Agent",
          images: [imageEntry],
          lastModified: obj.LastModified,
        });
      }
    }

    // Build final avatar list — custom first, then collections, then ungrouped
    const avatars = [...customAvatars];
    let index = 1;

    for (const [, collection] of collectionsMap) {
      // Sort images within collection by index
      collection.images.sort((a, b) => a.index - b.index);
      avatars.push({
        id: collection.id,
        name: collection.name || `RE Agent ${index}`,
        coverImage: collection.images[0]?.url,
        imageCount: collection.images.length,
        images: collection.images,
        lastModified: collection.lastModified,
      });
      index++;
    }

    for (const legacy of ungrouped) {
      avatars.push({
        id: legacy.id,
        name: legacy.name || `RE Agent ${index}`,
        coverImage: legacy.images[0]?.url,
        imageCount: legacy.images.length,
        images: legacy.images,
        lastModified: legacy.lastModified,
      });
      index++;
    }

    return NextResponse.json({ avatars }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[Public RE Avatars] R2 error:", err);
    return NextResponse.json({ error: "Failed to load avatars", avatars: [] }, { status: 500 });
  }
}
