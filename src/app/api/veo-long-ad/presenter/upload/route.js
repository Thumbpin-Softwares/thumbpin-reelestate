import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import { resolveUserFromSession } from "@/lib/user-resolver";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";
import { uploadToR2, extFromMime } from "@/lib/r2-upload";
import crypto from "crypto";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_IMAGES = 4;
const MAX_BYTES_PER_IMAGE = 10 * 1024 * 1024; // 10 MB each

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const resolvedUser = await resolveUserFromSession();
    const userId = resolvedUser?._id?.toString() ?? session.user.id;

    const formData = await req.formData();

    // Collect presenter images from presenterImage_0 … presenterImage_3
    const files = [];
    for (let i = 0; i < MAX_IMAGES; i++) {
      const file = formData.get(`presenterImage_${i}`);
      if (file && typeof file !== "string") files.push(file);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one presenter image is required" }, { status: 400 });
    }

    const collectionName = (formData.get("name") || "").toString().trim() || `Presenter — ${new Date().toLocaleDateString()}`;

    // One collectionId groups all images from this upload
    const collectionId = crypto.randomUUID();

    const urls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const contentType = file.type;

      if (!ALLOWED_MIME.has(contentType)) {
        return NextResponse.json(
          { error: `Image ${i + 1}: only JPEG, PNG, or WebP are allowed` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES_PER_IMAGE) {
        return NextResponse.json(
          { error: `Image ${i + 1} exceeds the 10 MB limit` },
          { status: 413 }
        );
      }

      const ext = extFromMime(contentType);
      const key = `users/${userId}/presenters/${collectionId}/${i}.${ext}`;
      const url = await uploadToR2(buffer, key, contentType);
      urls.push(url);
    }

    // Save collection as a single Asset record; first image is the primary url
    const asset = await Asset.create({
      userId,
      name: collectionName,
      url: urls[0],
      type: "presenter",
      metadata: {
        collectionId,
        urls,
        count: urls.length,
        source: "veo-long-ad-presenter-upload",
      },
    });

    return NextResponse.json({
      success: true,
      collectionId,
      assetId: asset._id.toString(),
      name: collectionName,
      urls,
      count: urls.length,
    });
  } catch (err) {
    console.error("[PresenterUpload] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
