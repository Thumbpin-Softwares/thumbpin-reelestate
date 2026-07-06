import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

export async function GET(request) {
  try {
    const { getResolvedUserId } = await import("@/lib/user-resolver");
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    await dbConnect();
    
    const query = { userId };
    if (type) query.type = type;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "24")), 50);
    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      Asset.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).allowDiskUse(true),
      Asset.countDocuments(query),
    ]);

    return NextResponse.json({
      assets,
      total,
      page,
      hasMore: skip + assets.length < total,
    });
  } catch (error) {
    console.error("[GET /api/assets] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { getResolvedUserId } = await import("@/lib/user-resolver");
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, type, metadata } = body;

    if (!name || !url || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();
    
    const asset = await Asset.create({
      userId,
      name,
      url,
      type,
      metadata,
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { getResolvedUserId } = await import("@/lib/user-resolver");
    const userId = await getResolvedUserId(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing asset ID" }, { status: 400 });

    const { name, thumbnailUrl } = await request.json();
    if (!name?.trim() && !thumbnailUrl) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await dbConnect();

    if (thumbnailUrl) {
      // Reorder metadata.urls so the chosen photo is first — every place that
      // renders a collection's cover (the pipeline's presenter picker, the
      // Asset Library) reads urls[0]/asset.url as the thumbnail.
      const asset = await Asset.findOne({ _id: id, userId });
      if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

      const urls = asset.metadata?.urls;
      if (!Array.isArray(urls) || !urls.includes(thumbnailUrl)) {
        return NextResponse.json({ error: "Photo not found in this collection" }, { status: 400 });
      }

      asset.metadata = { ...asset.metadata, urls: [thumbnailUrl, ...urls.filter((u) => u !== thumbnailUrl)] };
      asset.url = thumbnailUrl;
      if (name?.trim()) asset.name = name.trim();
      await asset.save();

      return NextResponse.json({ success: true, asset });
    }

    const asset = await Asset.findOneAndUpdate(
      { _id: id, userId },
      { name: name.trim() },
      { new: true }
    );
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { getResolvedUserId } = await import("@/lib/user-resolver");
    const userId = await getResolvedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing asset ID" }, { status: 400 });
    }

    await dbConnect();
    
    const asset = await Asset.findOneAndDelete({ _id: id, userId });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
