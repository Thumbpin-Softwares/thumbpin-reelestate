import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/avatar/generate-photo
 * Generates a personalized AI avatar photo using HeyGen.
 * Body: { name, age, gender, ethnicity, orientation, pose, style, appearance }
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
    const {
      name, age, gender, ethnicity, orientation, pose, style,
      appearance,
      skinTone, hair, dressingStyle, accessories, place, extraNotes,
    } = body;

    if (!name || !age || !gender || !ethnicity || !orientation || !pose || !style || !appearance) {
      return NextResponse.json({ error: "appearance, name, age, gender, ethnicity, orientation, pose, and style are required" }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "avatar_photo",
      metadata: { endpoint: "/api/avatar/generate-photo" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    // Build an enriched appearance prompt by appending the extra customization fields
    const enrichments = [
      skinTone && `Skin tone: ${skinTone}`,
      hair && `Hair: ${hair}`,
      dressingStyle && `Dressing style: ${dressingStyle}`,
      accessories && `Accessories: ${accessories}`,
      place && `Background / setting: ${place}`,
      extraNotes && extraNotes,
    ].filter(Boolean);

    const enrichedAppearance = enrichments.length > 0
      ? `${appearance.trim()}. ${enrichments.join(". ")}.`
      : appearance.trim();

    const response = await fetch("https://api.heygen.com/v2/photo_avatar/photo/generate", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ name, age, gender, ethnicity, orientation, pose, style, appearance: enrichedAppearance }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[generate-photo] HeyGen error:", data);
      await refundCreditsForAction({
        userId,
        action: "avatar_photo",
        debit,
        metadata: {
          endpoint: "/api/avatar/generate-photo",
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
    console.error("[generate-photo] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "avatar_photo",
        debit,
        metadata: {
          endpoint: "/api/avatar/generate-photo",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json({ error: error.message || "Photo generation failed" }, { status: 500 });
  }
}
