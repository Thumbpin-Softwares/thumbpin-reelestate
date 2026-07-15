import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { resolveUserFromSession } from "@/lib/user-resolver";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";

/**
 * POST /api/real-estate-video/save-composites
 * Saves composite data-URLs to R2 + creates Asset records in MongoDB.
 * Input: JSON { composites: [{ dataUrl, name }], selectedIndex }
 * Saves all EXCEPT the selected one (that one goes through the pipeline).
 */
export async function POST(request) {
  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { composites, selectedIndex } = await request.json();

    if (!composites || !Array.isArray(composites) || composites.length === 0) {
      return NextResponse.json({ error: "No composites to save" }, { status: 400 });
    }

    await dbConnect();
    const saved = [];

    for (let i = 0; i < composites.length; i++) {
      // Skip the selected one — it's being piped into the video pipeline
      if (i === selectedIndex) continue;

      const { dataUrl, name } = composites[i];
      if (!dataUrl) continue;

      // ── Decode data-URL ───────────────────────────────────────────────────
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) continue;

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const ext = mimeType.includes("png") ? "png" : "jpg";

      // ── Upload to R2 ──────────────────────────────────────────────────────
      const key = buildUserKey(user._id.toString(), "composites", ext, "composite");
      const url = await uploadToR2(buffer, key, mimeType);

      // ── Save metadata in MongoDB ──────────────────────────────────────────
      const asset = await Asset.create({
        userId: user._id.toString(),
        name: name || `RE Composite ${i + 1}`,
        url,
        type: "composite",
        metadata: {
          r2Key: key,
          source: "real-estate-pipeline",
          originalIndex: i,
        },
      });

      saved.push({ id: asset._id, url, name: asset.name });
    }

    return NextResponse.json({
      success: true,
      saved,
      message: `${saved.length} composite(s) saved to library`,
    });
  } catch (error) {
    console.error("[SaveComposites] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
