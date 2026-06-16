import { NextResponse } from "next/server";

/**
 * GET /api/avatar/training-status?group_id=xxx
 * Polls the training status for a photo avatar group.
 * Returns: { status } — pending | processing | ready | failed
 */
export async function GET(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const group_id = searchParams.get("group_id");

  if (!group_id) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.heygen.com/v2/photo_avatar/train/status/${group_id}`,
      {
        headers: {
          "accept": "application/json",
          "x-api-key": apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[training-status] HeyGen error:", data);
      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    return NextResponse.json({
      status: result.status,
      group_id,
    });
  } catch (error) {
    console.error("[training-status] Error:", error);
    return NextResponse.json({ error: error.message || "Training status check failed" }, { status: 500 });
  }
}
