import { NextResponse } from "next/server";

/**
 * GET /api/avatar/list-groups?include_public=false
 * Retrieves a list of all available photo avatar groups.
 * Returns: { groups: [...] }
 */
export async function GET(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const include_public = searchParams.get("include_public") || "false";

  try {
    const response = await fetch(
      `https://api.heygen.com/v2/avatar_group.list?include_public=${include_public}`,
      {
        headers: {
          "accept": "application/json",
          "x-api-key": apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[list-groups] HeyGen error:", data);
      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    const groups = result.avatar_group_list || result.groups || result || [];

    return NextResponse.json({ success: true, groups });
  } catch (error) {
    console.error("[list-groups] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list groups" }, { status: 500 });
  }
}
