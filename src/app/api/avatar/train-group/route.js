import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/avatar/train-group
 * Initiates training for a photo avatar group.
 * Body: { group_id }
 * Returns: { success, job_id }
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
    const { group_id } = body;

    if (!group_id) {
      return NextResponse.json({ error: "group_id is required" }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "avatar_group_training",
      metadata: {
        endpoint: "/api/avatar/train-group",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const response = await fetch("https://api.heygen.com/v2/photo_avatar/train", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ group_id }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[train-group] HeyGen error:", data);
      await refundCreditsForAction({
        userId,
        action: "avatar_group_training",
        debit,
        metadata: {
          endpoint: "/api/avatar/train-group",
          reason: "provider_error",
          status: response.status,
        },
      });

      return NextResponse.json(
        { error: data.message || data.error || `HeyGen error (${response.status})` },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    const result = data.data || data;
    return NextResponse.json({
      success: true,
      job_id: result.job_id || result.id,
    });
  } catch (error) {
    console.error("[train-group] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "avatar_group_training",
        debit,
        metadata: {
          endpoint: "/api/avatar/train-group",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json({ error: error.message || "Training failed to start" }, { status: 500 });
  }
}
