import { PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import { s3, BUCKET } from "@/lib/r2";
import path from "path";
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);

// POST - Create new collection
export async function POST(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    const type = formData.get("type");
    const collectionName = formData.get("name") || `Collection_${Date.now()}`;

    if (!files || files.length === 0 || !type) {
      return NextResponse.json({ error: "files and type are required" }, { status: 400 });
    }

    if (!["product", "real-estate"].includes(type)) {
      return NextResponse.json({ error: "type must be 'product' or 'real-estate'" }, { status: 400 });
    }

    const collectionId = uuidv4();
    const uploadedFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name) || ".png";
      const filename = `${collectionId}_${i + 1}${ext}`;
      
      const key = type === "real-estate" 
        ? `Avatars/RE/${filename}` 
        : `Avatars/${filename}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
          Metadata: {
            'collection-id': collectionId,
            'collection-name': collectionName,
            'type': type,
            'file-index': i.toString(),
            'total-files': files.length.toString(),
            'uploaded-at': new Date().toISOString()
          }
        })
      );

      uploadedFiles.push({
        id: `${collectionId}_${i}`,
        filename,
        key,
        index: i,
        url: `/api/admin/r2?key=${encodeURIComponent(key)}`
      });
    }

    return NextResponse.json({
      success: true,
      collection: {
        id: collectionId,
        name: collectionName,
        type: type,
        createdAt: new Date().toISOString(),
        fileCount: files.length,
        coverImage: uploadedFiles[0].url,
        files: uploadedFiles
      }
    });
  } catch (err) {
    console.error("[Avatar Upload] Error:", err);
    return NextResponse.json({ error: "Upload failed: " + err.message }, { status: 500 });
  }
}

// PATCH - Set thumbnail for a collection
export async function PATCH(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { collectionId, thumbnailKey } = await request.json();
    if (!collectionId || !thumbnailKey) {
      return NextResponse.json({ error: "collectionId and thumbnailKey are required" }, { status: 400 });
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `Avatars/meta/${collectionId}.json`,
        Body: JSON.stringify({ thumbnailKey }),
        ContentType: "application/json",
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Avatar Thumbnail] Error:", err);
    return NextResponse.json({ error: "Failed to set thumbnail" }, { status: 500 });
  }
}

// GET - List all collections or specific collection
export async function GET(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const collectionId = searchParams.get("collectionId");

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: "Avatars/",
    });

    const response = await s3.send(listCommand);
    const objects = response.Contents || [];

    // If requesting specific collection
    if (collectionId) {
      const collectionFiles = [];

      for (const obj of objects) {
        if (obj.Key.endsWith('/')) continue;

        try {
          const headCommand = new HeadObjectCommand({
            Bucket: BUCKET,
            Key: obj.Key,
          });
          const metadata = await s3.send(headCommand);

          if (metadata.Metadata?.['collection-id'] === collectionId) {
            collectionFiles.push({
              id: obj.Key,
              filename: path.basename(obj.Key),
              key: obj.Key,
              url: `/api/admin/r2?key=${encodeURIComponent(obj.Key)}`,
              index: parseInt(metadata.Metadata?.['file-index'] || '0')
            });
          }
        } catch (err) {
          console.error(`Error getting metadata for ${obj.Key}:`, err);
        }
      }

      if (collectionFiles.length === 0) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }

      collectionFiles.sort((a, b) => a.index - b.index);

      const firstFileMeta = await s3.send(new HeadObjectCommand({
        Bucket: BUCKET,
        Key: collectionFiles[0].key,
      }));

      // Read thumbnail manifest if one exists
      let thumbnailKey = null;
      try {
        const manifestRes = await s3.send(new GetObjectCommand({
          Bucket: BUCKET,
          Key: `Avatars/meta/${collectionId}.json`,
        }));
        const text = await manifestRes.Body.transformToString();
        thumbnailKey = JSON.parse(text).thumbnailKey || null;
      } catch {
        // No manifest — use first file
      }

      const coverImage = thumbnailKey
        ? `/api/admin/r2?key=${encodeURIComponent(thumbnailKey)}`
        : collectionFiles[0].url;

      return NextResponse.json({
        collection: {
          id: collectionId,
          name: firstFileMeta.Metadata?.['collection-name'] || 'Untitled',
          type: firstFileMeta.Metadata?.type || 'product',
          createdAt: firstFileMeta.Metadata?.['uploaded-at'] || new Date().toISOString(),
          fileCount: collectionFiles.length,
          coverImage,
          thumbnailKey,
          files: collectionFiles
        }
      });
    }

    // Return all collections
    const collectionsMap = new Map();
    
    for (const obj of objects) {
      if (obj.Key.endsWith('/')) continue;
      
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
        });
        const metadata = await s3.send(headCommand);
        const collId = metadata.Metadata?.['collection-id'];
        
        if (collId && !collectionsMap.has(collId)) {
          collectionsMap.set(collId, {
            id: collId,
            name: metadata.Metadata?.['collection-name'] || 'Untitled',
            type: metadata.Metadata?.type || 'product',
            createdAt: metadata.Metadata?.['uploaded-at'] || new Date().toISOString(),
            fileCount: parseInt(metadata.Metadata?.['total-files'] || '1'),
            coverImage: `/api/admin/r2?key=${encodeURIComponent(obj.Key)}`
          });
        }
      } catch (err) {
        console.error(`Error processing ${obj.Key}:`, err);
      }
    }

    // Read thumbnail manifests for all collections in parallel
    await Promise.all(
      Array.from(collectionsMap.entries()).map(async ([collId, coll]) => {
        try {
          const manifestRes = await s3.send(new GetObjectCommand({
            Bucket: BUCKET,
            Key: `Avatars/meta/${collId}.json`,
          }));
          const text = await manifestRes.Body.transformToString();
          const { thumbnailKey } = JSON.parse(text);
          if (thumbnailKey) {
            coll.coverImage = `/api/admin/r2?key=${encodeURIComponent(thumbnailKey)}`;
            coll.thumbnailKey = thumbnailKey;
          }
        } catch {
          // No manifest — keep first-file coverImage
        }
      })
    );

    const collections = Array.from(collectionsMap.values());
    collections.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({
      collections,
      total: collections.length
    });
  } catch (err) {
    console.error("[Avatar List] Error:", err);
    return NextResponse.json({ error: "Failed to list collections: " + err.message }, { status: 500 });
  }
}

// DELETE - Remove entire collection
export async function DELETE(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { collectionId } = await request.json();

    if (!collectionId) {
      return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
    }

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: "Avatars/",
    });

    const response = await s3.send(listCommand);
    const objects = response.Contents || [];

    const toDelete = [];
    
    for (const obj of objects) {
      if (obj.Key.endsWith('/')) continue;
      
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
        });
        const metadata = await s3.send(headCommand);
        
        if (metadata.Metadata?.['collection-id'] === collectionId) {
          toDelete.push(obj.Key);
        }
      } catch (err) {
        console.error(`Error checking ${obj.Key}:`, err);
      }
    }

    for (const key of toDelete) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }

    // Delete thumbnail manifest if one exists
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: `Avatars/meta/${collectionId}.json`,
      }));
    } catch {
      // No manifest to delete
    }

    return NextResponse.json({
      success: true,
      deletedCount: toDelete.length
    });
  } catch (err) {
    console.error("[Avatar Delete Collection] Error:", err);
    return NextResponse.json({ error: "Failed to delete collection" }, { status: 500 });
  }
}