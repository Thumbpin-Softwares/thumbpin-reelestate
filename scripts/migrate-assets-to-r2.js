/**
 * migrate-assets-to-r2.js
 * ──────────────────────────────────────────────────────────────────────────
 * One-time migration script: moves all existing user assets that live on
 * local disk to Cloudflare R2, and updates MongoDB in-place.
 *
 * This version uses your existing 'mongoose' dependency.
 *
 * RUN LOCALLY:
 *   node --env-file=.env.local scripts/migrate-assets-to-r2.js
 *
 * RUN ON SERVER:
 *   node --env-file=.env scripts/migrate-assets-to-r2.js
 * ──────────────────────────────────────────────────────────────────────────
 */

const path = require("path");
const fs = require("fs/promises");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mongoose = require("mongoose");
const crypto = require("crypto");

// ── R2 client ──────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

// ── Asset Schema (Minimal for migration) ───────────────────────────────────
const AssetSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  url: String,
  name: String,
  metadata: mongoose.Schema.Types.Mixed
}, { strict: false });

const Asset = mongoose.models.Asset || mongoose.model("Asset", AssetSchema);

// ── Helpers ────────────────────────────────────────────────────────────────
function localUrlToPath(url) {
  return path.join(process.cwd(), "public", url);
}

function categoryFromUrl(url) {
  if (url.startsWith("/uploads/")) return "uploads";
  if (url.startsWith("/composites/")) return "composites";
  if (url.startsWith("/generated-videos/")) return "videos";
  return "uploads";
}

function mimeFromExt(ext) {
  const m = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm"
  };
  return m[ext.toLowerCase()] || "application/octet-stream";
}

async function uploadToR2(buffer, key, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType
    })
  );
  return `/api/r2/user?key=${encodeURIComponent(key)}`;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI not set");

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected.");

  const localAssets = await Asset.find({
    url: { $regex: "^/(uploads|composites|generated-videos)/" }
  });

  console.log(`\n📦 Found ${localAssets.length} asset(s) to migrate.\n`);

  if (localAssets.length === 0) {
    console.log("✅ All assets are already migrated or no local assets found.");
    process.exit(0);
  }

  let migrated = 0;
  let skipped = 0;

  for (const asset of localAssets) {
    const diskPath = localUrlToPath(asset.url);
    const filename = path.basename(asset.url);
    const ext = filename.split(".").pop() || "bin";
    const category = categoryFromUrl(asset.url);

    process.stdout.write(`  → [${asset._id}] "${asset.name}" (${asset.url}) ... `);

    try {
      await fs.access(diskPath);
      const buffer = await fs.readFile(diskPath);
      const key = `users/${asset.userId}/${category}/${crypto.randomUUID().split("-")[0]}-${filename}`;
      const newUrl = await uploadToR2(buffer, key, mimeFromExt(ext));

      asset.url = newUrl;
      asset.metadata = {
        ...(asset.metadata || {}),
        r2Key: key,
        migratedFrom: asset.url,
        migratedAt: new Date().toISOString()
      };
      
      await asset.save();
      console.log(`✅ → ${newUrl}`);
      migrated++;
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log("⚠️ File not found on this machine — skipping");
        skipped++;
      } else {
        console.log(`❌ Failed: ${err.message}`);
      }
    }
  }

  console.log(`\nMigration complete. Migrated: ${migrated}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
