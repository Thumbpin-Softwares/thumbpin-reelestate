import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET, R2_PUBLIC_URL } from "./r2";
import crypto from "crypto";

/**
 * Upload a Buffer to Cloudflare R2.
 *
 * @param {Buffer}  buffer      - File bytes
 * @param {string}  key         - R2 object key, e.g. "users/abc123/videos/clip.mp4"
 * @param {string}  contentType - MIME type, e.g. "video/mp4"
 * @returns {string} The internal proxy URL: /api/r2/user?key=<encoded_key>
 */
export async function uploadToR2(buffer, key, contentType = "application/octet-stream") {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  return `/api/r2?key=${encodeURIComponent(key)}`;
}

/**
 * Mint a short-lived presigned PUT URL so the browser can upload a file
 * directly to R2, bypassing the Next.js route handler's request body entirely.
 * Needed on Vercel specifically — its serverless functions hard-cap request
 * bodies at 4.5MB, well under what a real photo/avatar upload needs, and that
 * limit isn't raiseable from app code (unlike the "20mb" configured for
 * Server Actions in next.config.mjs, which doesn't apply to file uploads
 * going through a route handler's formData()).
 *
 * @param {string} key         - R2 object key to upload to
 * @param {string} contentType - MIME type the client will send
 * @param {number} expiresIn   - URL validity in seconds (default 5 min)
 * @returns {Promise<string>} presigned PUT URL
 */
export async function getPresignedUploadUrl(key, contentType, expiresIn = 300) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Build a namespaced R2 key for a user asset.
 *
 * @param {string} userId    - MongoDB user ID string
 * @param {string} category  - "uploads" | "composites" | "videos"
 * @param {string} ext       - File extension without dot, e.g. "mp4"
 * @param {string} [prefix]  - Optional filename prefix, e.g. "real-estate"
 * @returns {string} e.g. "users/abc123/videos/real-estate-1715000000000.mp4"
 */
export function buildUserKey(userId, category, ext, prefix = "asset") {
  const timestamp = Date.now();
  const id = crypto.randomUUID().split("-")[0]; // short random suffix
  return `users/${userId}/${category}/${prefix}-${timestamp}-${id}.${ext}`;
}

/**
 * Derive a file extension from a MIME type.
 * @param {string} mimeType
 * @returns {string}
 */
export function extFromMime(mimeType = "") {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
  };
  return map[mimeType] || mimeType.split("/")[1] || "bin";
}
