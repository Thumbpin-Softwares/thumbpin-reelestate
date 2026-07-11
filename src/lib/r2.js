import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

/**
 * Shared Cloudflare R2 client (S3-compatible).
 * Configured via environment variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * requestHandler timeouts are raised well above the SDK default (which is
 * tuned for small API calls) — rendered video buffers can take a while to
 * push over the wire, and the default socket timeout was closing the
 * connection mid-upload (surfaced as a `write EPIPE`/TimeoutError).
 */
export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 10_000,
    requestTimeout: 300_000,
  }),
  maxAttempts: 3,
});

export const BUCKET = process.env.R2_BUCKET_NAME;

// R2 public base URL — set R2_PUBLIC_URL in .env after enabling public access on the bucket
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || null;

/**
 * Returns a URL for a key:
 * - Public assets (Avatars/) → direct CDN URL (zero latency, no Vercel hop)
 * - User assets → presigned URL valid for `expiresIn` seconds (default 1 hour)
 */
export async function getAssetUrl(key, expiresIn = 3600, { contentDisposition } = {}) {
  const PUBLIC_PREFIXES = ["Avatars/", "web-assets/", "Music/"];
  if (R2_PUBLIC_URL && PUBLIC_PREFIXES.some((p) => key.startsWith(p))) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(contentDisposition && { ResponseContentDisposition: contentDisposition }),
  });
  return awsGetSignedUrl(s3, command, { expiresIn });
}

/**
 * Frontend hooks (e.g. useAvatars) hand back relative `/api/r2?key=...` proxy
 * URLs so <img> tags can load them same-origin — but that relative path is
 * meaningless to a third-party API (fal.ai etc.) fetching it server-side.
 * Same fix already applied ad-hoc in luxury-car-exit/action-reel/news-anchor/
 * comedy-reel/home-tour's generate-pipeline routes; centralized here so the
 * template pipeline (and any future one) doesn't have to repeat it.
 */
export function resolveR2Url(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("http")) return url;
  if (url.includes("/api/r2?key=") && R2_PUBLIC_URL) {
    const key = decodeURIComponent(url.split("?key=")[1] || "");
    if (key) return `${R2_PUBLIC_URL}/${key}`;
  }
  return url;
}
