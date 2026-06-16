import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * Image-to-Video API — Animate a still image into video
 * Uses the image as the starting/reference frame (like Higgsfield, Kling, Runway)
 * Multi-model: routes to selected provider's image-to-video endpoint
 */

const MODEL_CONFIGS = {
  kling: {
    name: "Kling AI",
    envKey: "KLING_API_KEY",
    mapRequest: (imageUrl, prompt, settings, apiKey) => ({
      url: "https://api.klingai.com/v1/videos/image2video",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        image: imageUrl,
        prompt: prompt || "",
        negative_prompt: settings.negative_prompt || "",
        cfg_scale: 0.5,
        mode: settings.quality || "std",
        duration: settings.duration || "5",
      },
    }),
  },
  runway: {
    name: "Runway ML",
    envKey: "RUNWAY_API_KEY",
    mapRequest: (imageUrl, prompt, settings, apiKey) => ({
      url: "https://api.dev.runwayml.com/v1/image_to_video",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: {
        model: "gen4_turbo",
        promptImage: imageUrl,
        promptText: prompt || "Animate this image with natural motion",
        duration: parseInt(settings.duration) || 5,
        ratio: settings.aspect_ratio === "9:16" ? "768:1344" : "1344:768",
      },
    }),
  },
  luma: {
    name: "Luma Dream Machine",
    envKey: "LUMA_API_KEY",
    mapRequest: (imageUrl, prompt, settings, apiKey) => ({
      url: "https://api.lumalabs.ai/dream-machine/v1/generations",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        prompt: prompt || "Animate this image",
        keyframes: {
          frame0: {
            type: "image",
            url: imageUrl,
          },
        },
        aspect_ratio: settings.aspect_ratio || "16:9",
        loop: false,
      },
    }),
  },
  minimax: {
    name: "Minimax (Hailuo)",
    envKey: "MINIMAX_API_KEY",
    mapRequest: (imageUrl, prompt, settings, apiKey) => ({
      url: "https://api.minimax.chat/v1/video_generation",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: "video-01",
        prompt: prompt || "Animate this image with natural motion",
        first_frame_image: imageUrl,
      },
    }),
  },
  pika: {
    name: "Pika Labs",
    envKey: "PIKA_API_KEY",
    mapRequest: (imageUrl, prompt, settings, apiKey) => ({
      url: "https://api.pika.art/v1/generate",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        prompt: prompt || "Animate this image",
        image: imageUrl,
        style: settings.style || "cinematic",
        duration: parseInt(settings.duration) || 3,
      },
    }),
  },
};

export async function POST(request) {
  let userId = null;
  let debit = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

    const body = await request.json();
    const { image_url, prompt, model = "kling", settings = {} } = body;

    if (!image_url) {
      return NextResponse.json(
        { error: "Image URL is required." },
        { status: 400 }
      );
    }

    if (!MODEL_CONFIGS[model]) {
      return NextResponse.json(
        { error: `Unknown model "${model}". Supported: ${Object.keys(MODEL_CONFIGS).join(", ")}` },
        { status: 400 }
      );
    }

    const config = MODEL_CONFIGS[model];
    const apiKey = process.env[config.envKey];

    // Demo mode
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        demo: true,
        model: config.name,
        message: `${config.envKey} not configured. Add it to .env.local for real image-to-video generation.`,
        video_id: `demo-i2v-${Date.now()}`,
        status: "demo",
        source_image: image_url,
      });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "image_to_video",
      metadata: {
        endpoint: "/api/image-to-video",
        model,
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const mapped = config.mapRequest(image_url, prompt?.trim() || "", settings, apiKey);

    const response = await fetch(mapped.url, {
      method: "POST",
      headers: mapped.headers,
      body: JSON.stringify(mapped.body),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[I2V] ${config.name} error:`, response.status, responseData);
      await refundCreditsForAction({
        userId,
        action: "image_to_video",
        debit,
        metadata: {
          endpoint: "/api/image-to-video",
          model,
          reason: "provider_error",
          status: response.status,
        },
      });

      return NextResponse.json(
        { error: `${config.name} error (${response.status}): ${responseData?.error?.message || responseData?.message || "Unknown error"}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      demo: false,
      model: config.name,
      data: responseData,
      video_id: responseData?.id || responseData?.task_id || responseData?.generation_id || null,
      status: responseData?.status || "processing",
    });
  } catch (error) {
    console.error("[I2V] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "image_to_video",
        debit,
        metadata: {
          endpoint: "/api/image-to-video",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Image-to-video generation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const models = Object.entries(MODEL_CONFIGS).map(([id, config]) => ({
    id,
    name: config.name,
    configured: !!process.env[config.envKey],
    envKey: config.envKey,
  }));
  return NextResponse.json({ models });
}
