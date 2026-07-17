import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { getResolvedUserId } from "@/lib/user-resolver";

/**
 * POST /api/assets/confirm
 *
 * Step 2 of the direct-to-R2 upload flow: after the client has PUT the file
 * straight to the presigned URL from /api/assets/upload-url, it calls this
 * (small JSON body — just the key/url/name/type) to persist the Asset doc,
 * same as the old single-request /api/assets/upload did after its own
 * server-side upload.
 */
export async function POST(request) {
  try {
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key, url, name, type, originalName } = await request.json();
    if (!key || !url) {
      return NextResponse.json({ error: "key and url are required" }, { status: 400 });
    }

    // The presigned PUT URL from /api/assets/upload-url only ever issues
    // keys under this exact prefix — reject anything else so a client can't
    // register someone else's key/url (or an arbitrary external URL) as its
    // own asset.
    if (!key.startsWith(`users/${userId}/`)) {
      return NextResponse.json({ error: "Invalid asset key" }, { status: 403 });
    }

    await dbConnect();
    const asset = await Asset.create({
      userId,
      name: (name || "Untitled Asset").trim().substring(0, 100),
      url,
      type: type || "general",
      metadata: {
        is_custom: true,
        r2Key: key,
        originalName: originalName || "",
      },
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("[Asset Confirm] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
