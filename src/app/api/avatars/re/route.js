/**
 * GET /api/avatars/re — SSE stream of RE avatar collections.
 *
 * Events:
 *   { type: "library",  library: [...] }        — user's saved avatars (sent first, from DB)
 *   { type: "avatar",   avatar: {...} }          — one collection at a time
 *   { type: "done" }                             — stream complete
 *   { type: "error",    message: "..." }         — unrecoverable failure
 *
 * Parallel HEAD requests (10 at a time) replace the old sequential loop.
 */

import { ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "@/lib/r2";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { getResolvedUserId } from "@/lib/user-resolver";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const RE_PREFIX = "Avatars/RE/";
const CONCURRENCY = 10;

function isImage(key) {
  const dot = key.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTS.has(key.slice(dot).toLowerCase());
}

async function runBatched(items, size, fn) {
  const out = new Array(items.length).fill(null);
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const settled = await Promise.allSettled(batch.map(fn));
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === "fulfilled") out[i + j] = settled[j].value;
    }
  }
  return out;
}

export async function GET(request) {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (data) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // Fetch user library + list R2 objects in parallel
        const [libraryResult, objectsResult] = await Promise.allSettled([
          (async () => {
            const userId = await getResolvedUserId(request);
            if (!userId) return [];
            await dbConnect();
            const rows = await Asset.find({ userId, type: "avatar" }).sort({ createdAt: -1 });
            return rows.map((a) => ({
              id: a._id.toString(),
              name: a.name || "Custom Avatar",
              url: a.url,
              createdAt: a.createdAt,
            }));
          })(),
          (async () => {
            const objects = [];
            let token;
            do {
              const resp = await s3.send(
                new ListObjectsV2Command({ Bucket: BUCKET, Prefix: RE_PREFIX, ContinuationToken: token })
              );
              for (const obj of resp.Contents ?? []) {
                if (isImage(obj.Key)) objects.push(obj);
              }
              token = resp.IsTruncated ? resp.NextContinuationToken : null;
            } while (token);
            return objects;
          })(),
        ]);

        // Send library immediately — it comes from DB, no R2 wait
        send({ type: "library", library: libraryResult.value ?? [] });

        const objects = objectsResult.value ?? [];
        if (!objects.length) {
          send({ type: "done" });
          controller.close();
          return;
        }

        // Parallel HEAD requests to read collection metadata
        const heads = await runBatched(objects, CONCURRENCY, async (obj) => {
          const h = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
          return {
            key: obj.Key,
            lastModified: obj.LastModified,
            collectionId: h.Metadata?.["collection-id"] ?? null,
            collectionName: h.Metadata?.["collection-name"] ?? null,
            fileIndex: parseInt(h.Metadata?.["file-index"] ?? "0"),
          };
        });

        // Group into collections
        const collectionsMap = new Map();
        const ungrouped = [];

        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          const meta = heads[i];
          const filename = obj.Key.slice(RE_PREFIX.length);
          const entry = {
            url: `/api/r2?key=${encodeURIComponent(obj.Key)}`,
            key: obj.Key,
            index: meta?.fileIndex ?? 0,
            displayName: filename.replace(/\.[^/.]+$/, ""),
          };

          if (meta?.collectionId) {
            if (!collectionsMap.has(meta.collectionId)) {
              collectionsMap.set(meta.collectionId, {
                id: meta.collectionId,
                name: meta.collectionName || "RE Agent",
                images: [],
                lastModified: obj.LastModified,
              });
            }
            collectionsMap.get(meta.collectionId).images.push(entry);
          } else {
            ungrouped.push({
              id: `legacy-${filename}`,
              name: entry.displayName || "RE Agent",
              images: [entry],
              lastModified: obj.LastModified,
            });
          }
        }

        // Fetch thumbnail manifests for all collections in parallel
        const collIds = Array.from(collectionsMap.keys());
        const thumbResults = await runBatched(collIds, CONCURRENCY, async (collId) => {
          const res = await s3.send(
            new GetObjectCommand({ Bucket: BUCKET, Key: `Avatars/meta/${collId}.json` })
          );
          const { thumbnailKey } = JSON.parse(await res.Body.transformToString());
          return { collId, thumbnailKey };
        });

        const thumbMap = new Map();
        for (const r of thumbResults) {
          if (r?.thumbnailKey) thumbMap.set(r.collId, r.thumbnailKey);
        }

        // Stream each collection — one event per card
        let idx = 1;
        for (const [collId, col] of collectionsMap) {
          col.images.sort((a, b) => a.index - b.index);
          const tk = thumbMap.get(collId);
          send({
            type: "avatar",
            avatar: {
              id: col.id,
              name: col.name || `RE Agent ${idx}`,
              coverImage: tk ? `/api/r2?key=${encodeURIComponent(tk)}` : col.images[0]?.url,
              imageCount: col.images.length,
              images: col.images,
              lastModified: col.lastModified,
            },
          });
          idx++;
        }
        for (const leg of ungrouped) {
          send({
            type: "avatar",
            avatar: {
              id: leg.id,
              name: leg.name || `RE Agent ${idx}`,
              coverImage: leg.images[0]?.url,
              imageCount: leg.images.length,
              images: leg.images,
              lastModified: leg.lastModified,
            },
          });
          idx++;
        }

        send({ type: "done" });
      } catch (err) {
        console.error("[RE Avatars stream]", err);
        send({ type: "error", message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
