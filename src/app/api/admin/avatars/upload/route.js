import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import fs from "fs/promises";
import path from "path";
import { writeFile } from "fs/promises";

const PRODUCT_AVATARS_DIR = path.join(process.cwd(), "Avatars");
const RE_AVATARS_DIR = path.join(process.cwd(), "Avatars", "RE");

// POST /api/admin/avatars/upload
export async function POST(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type"); // "product" | "real-estate"
  const customName = formData.get("name"); // optional

  if (!file || !type) {
    return NextResponse.json({ error: "file and type are required" }, { status: 400 });
  }

  if (!["product", "real-estate"].includes(type)) {
    return NextResponse.json({ error: "type must be 'product' or 'real-estate'" }, { status: 400 });
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, WEBP images are allowed" }, { status: 400 });
  }

  const targetDir = type === "real-estate" ? RE_AVATARS_DIR : PRODUCT_AVATARS_DIR;

  // Build filename
  const ext = path.extname(file.name) || ".png";
  const baseName = customName
    ? customName.replace(/[^a-zA-Z0-9_-]/g, "_") + ext
    : file.name.replace(/[^a-zA-Z0-9_.\-]/g, "_");
  const finalName = path.basename(baseName);
  const filePath = path.join(targetDir, finalName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({
    success: true,
    filename: finalName,
    type,
    url: `/api/admin/avatars/file?type=${type}&name=${encodeURIComponent(finalName)}`,
  });
}
