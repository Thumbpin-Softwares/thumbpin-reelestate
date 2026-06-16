import { NextResponse } from "next/server";

/**
 * POST /api/real-estate-video/upload-bg
 * Uploads a real estate background image to HeyGen asset storage.
 * Returns { asset_id } to be used as background in video generation.
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
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG or PNG. (WebP is currently not supported by HeyGen backgrounds)" },
        { status: 400 }
      );
    }

    console.log("[RE Upload BG] Converting file to ArrayBuffer...");
    // Convert File → ArrayBuffer so fetch sends raw binary correctly
    const fileBuffer = await file.arrayBuffer();

    console.log(
      `[RE Upload BG] Uploading ${file.name} (${file.type}, ${fileBuffer.byteLength} bytes) to HeyGen...`
    );

    const uploadResponse = await fetch("https://upload.heygen.com/v1/asset", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": file.type,
      },
      body: fileBuffer,
    });

    // Read as text first to safely handle non-JSON responses (e.g. HTML error pages)
    const rawText = await uploadResponse.text();
    let uploadData;
    try {
      uploadData = JSON.parse(rawText);
    } catch {
      console.error("[RE Upload BG] Non-JSON response from HeyGen:", rawText.substring(0, 300));
      return NextResponse.json(
        {
          error: `HeyGen returned an unexpected response (HTTP ${uploadResponse.status}). Check your API key and file format.`,
        },
        { status: 502 }
      );
    }

    if (!uploadResponse.ok) {
      console.error("[RE Upload BG] HeyGen error:", uploadData);
      return NextResponse.json(
        { error: uploadData.error?.message || uploadData.message || "Failed to upload background to HeyGen" },
        { status: uploadResponse.status }
      );
    }

    const asset_id = uploadData.data?.id || uploadData.data?.asset_id || uploadData.id;
    if (!asset_id) {
      console.error("[RE Upload BG] No asset_id in response:", uploadData);
      return NextResponse.json({ error: "No asset_id returned from HeyGen" }, { status: 500 });
    }

    console.log("[RE Upload BG] Success. asset_id:", asset_id);
    return NextResponse.json({ success: true, asset_id });
  } catch (error) {
    console.error("[RE Upload BG] Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
