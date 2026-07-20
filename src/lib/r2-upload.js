import { PutObjectCommand } from "@aws-sdk/client-s3";
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
