import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Shared Cloudflare R2 client (S3-compatible).
 * Configured via environment variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */
export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET = process.env.R2_BUCKET_NAME;

// R2 public base URL — set R2_PUBLIC_URL in .env after enabling public access on the bucket
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || null;

/**
 * Returns a URL for a key:
 * - Public assets (Avatars/) → direct CDN URL (zero latency, no Vercel hop)
 * - User assets → presigned URL valid for `expiresIn` seconds (default 1 hour)
 */
export async function getAssetUrl(key, expiresIn = 3600) {
  if (R2_PUBLIC_URL && key.startsWith("Avatars/")) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return awsGetSignedUrl(s3, command, { expiresIn });
}
