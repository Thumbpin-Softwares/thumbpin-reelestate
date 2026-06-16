import { NextResponse } from "next/server";

/**
 * POST /api/avatar/create-group
 * Creates a photo avatar group from an image_key.
 * Body: { name, image_key, generation_id? }
 * Returns: { group_id, avatar_id }
 */
export async function POST(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, image_key, generation_id } = body;

    if (!name || !image_key) {
      return NextResponse.json({ error: "name and image_key are required" }, { status: 400 });
    }

    const payload = { name, image_key };
    if (generation_id) payload.generation_id = generation_id;

    const response = await fetch("https://api.heygen.com/v2/photo_avatar/avatar_group/create", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[create-group] HeyGen error:", data);
      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    return NextResponse.json({
      success: true,
      group_id: result.group_id || result.id,
      avatar_id: result.avatar_id,
    });
  } catch (error) {
    console.error("[create-group] Error:", error);
    return NextResponse.json({ error: error.message || "Group creation failed" }, { status: 500 });
  }
}
