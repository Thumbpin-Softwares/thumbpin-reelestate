import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Video from "@/models/Video";
import dbConnect from "@/lib/db";

/**
 * POST /api/real-estate-video/generate
 * Generates a real estate spokesperson video using HeyGen.
 * Supports both library avatars and trained Digital Twin avatars.
 *
 * Body:
 * {
 *   avatar_id: string,        // HeyGen avatar_id (library or trained twin)
 *   bg_asset_id: string,      // asset_id of uploaded RE background image
 *   script: string,           // Text the avatar will speak
 *   voice_id: string,         // HeyGen voice_id
 *   aspect_ratio: "16:9"|"9:16"|"1:1"
 * }
 */
export async function POST(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { avatar_id, bg_asset_id, script, voice_id, aspect_ratio = "16:9" } = body;

    if (!avatar_id) {
      return NextResponse.json({ error: "avatar_id is required" }, { status: 400 });
    }
    if (!bg_asset_id) {
      return NextResponse.json({ error: "bg_asset_id is required — upload a background first" }, { status: 400 });
    }
    if (!script || script.trim().length < 10) {
      return NextResponse.json({ error: "Script must be at least 10 characters" }, { status: 400 });
    }
    if (!voice_id) {
      return NextResponse.json({ error: "voice_id is required" }, { status: 400 });
    }

    const dimension =
      aspect_ratio === "9:16"
        ? { width: 1080, height: 1920 }
        : aspect_ratio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 };

    const payload = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: script.trim(),
            voice_id,
          },
          background: {
            type: "image",
            image_asset_id: bg_asset_id,
          },
        },
      ],
      dimension,
    };

    console.log("[RE Generate] Sending to HeyGen:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();

    if (!response.ok) {
      console.error("[RE Generate] HeyGen error:", data);
      return NextResponse.json(
        {
          error: data.error?.message || data.message || `HeyGen error (${response.status})`,
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const video_id = data.data?.video_id || data.video_id;
    console.log("[RE Generate] Success. video_id:", video_id);

    // Save to MongoDB
    await dbConnect();
    await Video.create({
      userId: session.user.id,
      script: script.trim(),
      avatarUrl: avatar_id, // Store avatar_id as a reference
      voiceId: voice_id,
      status: "generating",
      video_id: video_id, // We need to add this to the model or use metadata
      metadata: {
        bg_asset_id,
        aspect_ratio,
        source: "heygen"
      }
    });

    return NextResponse.json({
      success: true,
      video_id,
      status: "processing",
    });
  } catch (error) {
    console.error("[RE Generate] Error:", error);
    return NextResponse.json({ error: error.message || "Video generation failed" }, { status: 500 });
  }
}
