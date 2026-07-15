import { NextResponse } from "next/server";
import { resolveUserFromSession } from "@/lib/user-resolver";
import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";

export async function GET(request) {
  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const products = await Product.find({ userId: user._id.toString() }).sort({ createdAt: -1 });
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



export async function POST(request) {
  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, targetAudience, tone, images, scripts, metadata } = body;

    if (!name || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();
    
    const product = await Product.create({
      userId: user._id.toString(),
      name,
      description,
      targetAudience,
      tone,
      images,
      scripts,
      metadata,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing product ID" }, { status: 400 });
    }

    await dbConnect();
    
    const product = await Product.findOneAndDelete({ _id: id, userId: user._id.toString() });
    if (!product) {
      return NextResponse.json({ error: "Product not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
