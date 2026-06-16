import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/avatar/generate-looks
 * Generates new AI looks for a photo avatar group using a text prompt.
 * Body: { group_id, prompt, orientation, pose, style }
 * Returns: { generation_id }
 */
export async function POST(request) {
  let userId = null;
  let debit = null;

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

    const body = await request.json();
    const { group_id, prompt, orientation = "square", pose = "half_body", style = "Realistic" } = body;

    if (!group_id || !prompt) {
      return NextResponse.json({ error: "group_id and prompt are required" }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "avatar_looks",
      metadata: {
        endpoint: "/api/avatar/generate-looks",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const response = await fetch("https://api.heygen.com/v2/photo_avatar/look/generate", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ group_id, prompt, orientation, pose, style }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[generate-looks] HeyGen error:", data);
      await refundCreditsForAction({
        userId,
        action: "avatar_looks",
        debit,
        metadata: {
          endpoint: "/api/avatar/generate-looks",
          reason: "provider_error",
          status: response.status,
        },
      });

      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const generation_id = data.data?.generation_id || data.generation_id;
    return NextResponse.json({ success: true, generation_id });
  } catch (error) {
    console.error("[generate-looks] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "avatar_looks",
        debit,
        metadata: {
          endpoint: "/api/avatar/generate-looks",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json({ error: error.message || "Look generation failed" }, { status: 500 });
  }
}
