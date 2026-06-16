import { NextResponse } from "next/server";

/**
 * POST /api/avatar/add-looks
 * Adds additional looks (images) to an existing photo avatar group.
 * Body: { group_id, image_keys: string[], name, generation_id? }
 * Returns: { success, look_ids }
 */
export async function POST(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { group_id, image_keys, name, generation_id } = body;

    if (!group_id || !image_keys?.length || !name) {
      return NextResponse.json(
        { error: "group_id, image_keys array, and name are required" },
        { status: 400 }
      );
    }

    if (image_keys.length > 4) {
      return NextResponse.json({ error: "Maximum 4 images can be added at a time" }, { status: 400 });
    }

    const payload = { group_id, image_keys, name };
    if (generation_id) payload.generation_id = generation_id;

    const response = await fetch("https://api.heygen.com/v2/photo_avatar/avatar_group/add_looks", {
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
      console.error("[add-looks] HeyGen error:", data);
      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[add-looks] Error:", error);
    return NextResponse.json({ error: error.message || "Add looks failed" }, { status: 500 });
  }
}
