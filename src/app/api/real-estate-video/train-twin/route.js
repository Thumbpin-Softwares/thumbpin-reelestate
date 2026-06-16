import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/real-estate-video/train-twin
 * Accepts a video file upload and initiates HeyGen Digital Twin training.
 * Returns { twin_id } — poll GET ?twin_id=... for training status.
 *
 * GET /api/real-estate-video/train-twin?twin_id=...
 * Polls HeyGen for digital twin training status.
 * Returns { status, avatar_id } when training is complete.
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

    const formData = await request.formData();
    const file = formData.get("file");
    const consentFile = formData.get("consent");
    const name = formData.get("name") || "My RE Avatar";

    if (!file || !consentFile) {
      return NextResponse.json({ error: "Both training footage and consent video are required." }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "digital_twin_training",
      metadata: {
        endpoint: "/api/real-estate-video/train-twin",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/mov"];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Please upload a video file (MP4, MOV, or WebM) for training footage." },
        { status: 400 }
      );
    }
    if (!allowedTypes.includes(consentFile.type) && !consentFile.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Please upload a video file (MP4, MOV, or WebM) for consent video." },
        { status: 400 }
      );
    }

    // Function to upload asset to HeyGen
    async function uploadAsset(fileObj, label) {
      console.log(`[RE Twin] Uploading ${label} asset...`);
      const fileBuffer = await fileObj.arrayBuffer();
      const assetResponse = await fetch("https://upload.heygen.com/v1/asset", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": fileObj.type,
        },
        body: fileBuffer,
      });

      const assetRaw = await assetResponse.text();
      let assetData;
      try { assetData = JSON.parse(assetRaw); } catch {
        throw new Error(`HeyGen returned unexpected response for ${label} (HTTP ${assetResponse.status})`);
      }

      if (!assetResponse.ok) {
        throw new Error(assetData.error?.message || `Failed to upload ${label} asset`);
      }

      const id = assetData.data?.id || assetData.data?.asset_id || assetData.id;
      if (!id) throw new Error(`No asset_id from HeyGen for ${label}`);
      return id;
    }

    // Step 1: Upload both assets
    const training_asset_id = await uploadAsset(file, "training footage");
    const consent_asset_id = await uploadAsset(consentFile, "consent video");

    // Step 2: Create Digital Twin (Instant Avatar)
    console.log("[RE Twin] Starting digital twin training...");
    const twinResponse = await fetch("https://api.heygen.com/v2/video_avatar", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        avatar_name: name,
        training_footage_asset_id: training_asset_id,
        video_consent_asset_id: consent_asset_id,
      }),
    });

    const twinData = await twinResponse.json();
    if (!twinResponse.ok) {
      console.error("[RE Twin] Training error:", twinData);
      await refundCreditsForAction({
        userId,
        action: "digital_twin_training",
        debit,
        metadata: {
          endpoint: "/api/real-estate-video/train-twin",
          reason: "provider_error",
          status: twinResponse.status,
        },
      });

      return NextResponse.json(
        { error: twinData.error?.message || "Failed to start Digital Twin training" },
        { status: twinResponse.status }
      );
    }

    const twin_id = twinData.data?.digital_twin_id || twinData.id || twinData.data?.avatar_id;
    console.log("[RE Twin] Training started. twin_id:", twin_id);

    return NextResponse.json({
      success: true,
      twin_id,
      status: "training",
      message: "Digital Twin training has started. This takes 15–30 minutes. Poll for status.",
    });
  } catch (error) {
    console.error("[RE Twin] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "digital_twin_training",
        debit,
        metadata: {
          endpoint: "/api/real-estate-video/train-twin",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json({ error: error.message || "Twin training failed" }, { status: 500 });
  }
}

export async function GET(request) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const twin_id = searchParams.get("twin_id");

  if (!twin_id) {
    return NextResponse.json({ error: "twin_id is required" }, { status: 400 });
  }

  try {
    console.log("[RE Twin] Polling training status for avatar_id:", twin_id);
    const response = await fetch(`https://api.heygen.com/v2/video_avatar/${twin_id}`, {
      headers: { "X-Api-Key": apiKey },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Failed to check twin status" },
        { status: response.status }
      );
    }

    const twinInfo = data.data || data;
    // Map modern status 'complete' to 'completed' for frontend compatibility if needed, 
    // or just pass it through. Standardizing on 'completed'.
    const status = twinInfo.status === "complete" ? "completed" : twinInfo.status;
    
    return NextResponse.json({
      twin_id,
      status: status || "training",
      avatar_id: twinInfo.avatar_id || twin_id, // For Instant Avatar, the ID itself is often the avatar_id
      name: twinInfo.avatar_name || twinInfo.name,
    });
  } catch (error) {
    console.error("[RE Twin] Poll error:", error);
    return NextResponse.json({ error: error.message || "Status check failed" }, { status: 500 });
  }
}
