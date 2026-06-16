import { uploadToR2, buildUserKey, extFromMime } from "./r2-upload";

/**
 * uploadFile — R2-backed replacement for the old disk-based upload.
 *
 * Maintains the same call signature as the previous version so all
 * existing callers don't need to change:
 *   uploadFile(file, category, userId) → "/api/r2/user?key=..."
 *
 * @param {File|Blob} file     - The file to upload
 * @param {string}    category - Folder name, e.g. "uploads", "avatars"
 * @param {string}    userId   - MongoDB user ID (required for namespacing)
 * @returns {Promise<string>}  Internal proxy URL
 */
export async function uploadFile(file, category = "uploads", userId = "unknown") {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = extFromMime(file.type) || "bin";
  const key = buildUserKey(userId, category, ext, category);
  return uploadToR2(buffer, key, file.type || "application/octet-stream");
}
