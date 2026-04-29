import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import fs from "fs/promises";
import path from "path";

const PRODUCT_AVATARS_DIR = path.join(process.cwd(), "Avatars");
const RE_AVATARS_DIR = path.join(process.cwd(), "Avatars", "RE");

async function getAvatarsFromDir(dir, type) {
  try {
    const files = await fs.readdir(dir);
    const images = files.filter((f) =>
      [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(f).toLowerCase())
    );
    return images.map((filename, i) => ({
      id: `${type}-${filename}`,
      filename,
      type,
      url: type === "real-estate"
        ? `/api/admin/avatars/file?type=real-estate&name=${encodeURIComponent(filename)}`
        : `/api/admin/avatars/file?type=product&name=${encodeURIComponent(filename)}`,
      displayName: filename.replace(/\.[^/.]+$/, ""),
      index: i + 1,
    }));
  } catch {
    return [];
  }
}

// GET /api/admin/avatars — list all avatars from both directories
export async function GET() {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [productAvatars, realEstateAvatars] = await Promise.all([
    getAvatarsFromDir(PRODUCT_AVATARS_DIR, "product"),
    getAvatarsFromDir(RE_AVATARS_DIR, "real-estate"),
  ]);

  return NextResponse.json({
    product: productAvatars,
    realEstate: realEstateAvatars,
    total: productAvatars.length + realEstateAvatars.length,
  });
}

// DELETE /api/admin/avatars — delete an avatar file
export async function DELETE(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, filename } = await request.json();

  if (!type || !filename) {
    return NextResponse.json({ error: "type and filename required" }, { status: 400 });
  }

  // Security: no path traversal
  const safeName = path.basename(filename);
  const targetDir = type === "real-estate" ? RE_AVATARS_DIR : PRODUCT_AVATARS_DIR;
  const filePath = path.join(targetDir, safeName);

  // Ensure it's within allowed dirs
  if (!filePath.startsWith(PRODUCT_AVATARS_DIR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
