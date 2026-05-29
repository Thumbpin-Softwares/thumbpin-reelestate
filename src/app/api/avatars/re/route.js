/**
 * Public Real-Estate Avatars API — GET /api/avatars/re
 *
 * Returns the list of available real-estate presenter avatars stored
 * in Cloudflare R2 under the Avatars/RE/ prefix, grouped by collection.
 * No auth required — these are shown to all logged-in users on the AI Walkthrough page.
 *
 * Response: { avatars: [{ id, name, images: [{url, key, index}], coverImage }] }
 */

import { ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
    // 1. Fetch user's saved custom avatars from MongoDB (returned as "library", not mixed into RE agents)
    let library = [];
    try {
      const userId = await getResolvedUserId(request);
      if (userId) {
        await dbConnect();
        const dbAssets = await Asset.find({ userId, type: "avatar" }).sort({ createdAt: -1 });
        library = dbAssets.map((asset) => ({
          id: asset._id.toString(),
          name: asset.name || "Custom Avatar",
          url: asset.url,
          createdAt: asset.createdAt,
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

    // Fetch thumbnail manifests for all collections in parallel
    const thumbnailMap = new Map();
    await Promise.all(
      Array.from(collectionsMap.keys()).map(async (collId) => {
        try {
          const res = await s3.send(new GetObjectCommand({
            Bucket: BUCKET,
            Key: `Avatars/meta/${collId}.json`,
          }));
          const text = await res.Body.transformToString();
          const { thumbnailKey } = JSON.parse(text);
          if (thumbnailKey) thumbnailMap.set(collId, thumbnailKey);
        } catch {
          // No manifest — use first image
        }
      })
    );

    // Build final avatar list — admin RE collections only (no user custom avatars)
    const avatars = [];
    let index = 1;

    for (const [collId, collection] of collectionsMap) {
      // Sort images within collection by index
      collection.images.sort((a, b) => a.index - b.index);

      const thumbnailKey = thumbnailMap.get(collId);
      const coverImage = thumbnailKey
        ? `/api/r2?key=${encodeURIComponent(thumbnailKey)}`
        : collection.images[0]?.url;

      avatars.push({
        id: collection.id,
        name: collection.name || `RE Agent ${index}`,
        coverImage,
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

    return NextResponse.json({ avatars, library }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[Public RE Avatars] R2 error:", err);
    return NextResponse.json({ error: "Failed to load avatars", avatars: [] }, { status: 500 });
  }
}
