import { NextResponse } from "next/server";

/**
 * GET /api/avatar/generation-status?generation_id=xxx
 * Polls the status of a photo or look generation job.
 * Returns: { status, image_key, image_url }
 * Status: in_progress | success | failed
 */
export async function GET(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const generation_id = searchParams.get("generation_id");

  if (!generation_id) {
    return NextResponse.json({ error: "generation_id is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.heygen.com/v2/photo_avatar/generation/${generation_id}`,
      {
        headers: {
          "accept": "application/json",
          "x-api-key": apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[generation-status] HeyGen error:", data);
      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    console.log("[generation-status] result:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      status: result.status,
      // Handle array versions from HeyGen v2
      image_key: result.image_key || (result.image_key_list && result.image_key_list[0]),
      image_url: result.image_url || (result.image_url_list && result.image_url_list[0]),
      image_url_list: result.image_url_list,
      image_key_list: result.image_key_list,
      generation_id,
    });
  } catch (error) {
    console.error("[generation-status] Error:", error);
    return NextResponse.json({ error: error.message || "Status check failed" }, { status: 500 });
  }
}
