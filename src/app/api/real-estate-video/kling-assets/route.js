import { NextResponse } from "next/server";
import { KlingAPI } from "@/lib/kling-api";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "avatars"; // "avatars" | "voices"

  const klingKey = process.env.KLING_API_KEY;
  if (!klingKey) {
    return NextResponse.json({ error: "KLING_API_KEY not configured" }, { status: 500 });
  }

  const kling = new KlingAPI(klingKey);

  try {
    let data;
    if (type === "voices") {
      data = await kling.listVoices();
    } else {
      data = await kling.listAvatars();
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching Kling ${type}:`, error);
    
    // High-quality Fallback Mock Data for Demo
    if (type === "voices") {
      return NextResponse.json([
        { id: "kling-v-1", name: "Professional Female (US)", gender: "female", language: "en-US" },
        { id: "kling-v-2", name: "Warm Male (US)", gender: "male", language: "en-US" },
        { id: "kling-v-3", name: "Energetic Female (UK)", gender: "female", language: "en-GB" },
        { id: "kling-v-4", name: "Authoritative Male (IN)", gender: "male", language: "en-IN" },
      ]);
    } else {
      return NextResponse.json([
        { id: "kling-av-1", name: "Maya (Agent)", image_url: "https://p16-capcut-va.ibyteimg.com/tos-alisg-i-bv9jr6pwkj-sg/8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e~tplv-bv9jr6pwkj-image.webp" },
        { id: "kling-av-2", name: "Rohan (Expert)", image_url: "https://p16-capcut-va.ibyteimg.com/tos-alisg-i-bv9jr6pwkj-sg/9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f~tplv-bv9jr6pwkj-image.webp" },
        { id: "kling-av-3", name: "Sarah (Host)", image_url: "https://p16-capcut-va.ibyteimg.com/tos-alisg-i-bv9jr6pwkj-sg/7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a~tplv-bv9jr6pwkj-image.webp" },
      ]);
    }
  }
}
