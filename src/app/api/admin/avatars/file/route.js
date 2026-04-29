import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import fs from "fs/promises";
import path from "path";

const PRODUCT_AVATARS_DIR = path.join(process.cwd(), "Avatars");
const RE_AVATARS_DIR = path.join(process.cwd(), "Avatars", "RE");

// GET /api/admin/avatars/file?type=product&name=1.png
// Serves avatar images directly (bypasses the public dir restriction)
export async function GET(request) {
  const session = await verifyAdminSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const name = searchParams.get("name");

  if (!type || !name) {
    return new NextResponse("Missing params", { status: 400 });
  }

  const safeName = path.basename(name);
  const targetDir = type === "real-estate" ? RE_AVATARS_DIR : PRODUCT_AVATARS_DIR;
  const filePath = path.join(targetDir, safeName);

  // Guard: ensure within allowed dirs
  if (!filePath.startsWith(PRODUCT_AVATARS_DIR)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mimeMap = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    const mime = mimeMap[ext] || "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
