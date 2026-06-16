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

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    await dbConnect();
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
