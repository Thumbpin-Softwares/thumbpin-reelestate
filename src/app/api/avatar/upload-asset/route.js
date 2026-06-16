import { NextResponse } from "next/server";

/**
 * POST /api/avatar/upload-asset
 * Uploads an image file to HeyGen's asset store.
 * Accepts multipart form data with a "file" field.
 * Returns: { image_key, asset_id }
 */
export async function POST(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const response = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-API-KEY": apiKey,
        "accept": "application/json",
      },
      body: buffer,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[upload-asset] HeyGen error:", data);
      return NextResponse.json(
        { error: data.message || data.error || `HeyGen upload error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    return NextResponse.json({
      success: true,
      image_key: result.image_key || result.key,
      asset_id: result.asset_id || result.id,
    });
  } catch (error) {
    console.error("[upload-asset] Error:", error);
    return NextResponse.json({ error: error.message || "Asset upload failed" }, { status: 500 });
  }
}
