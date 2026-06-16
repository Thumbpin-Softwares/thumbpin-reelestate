import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * Text-to-Video Generation API
 * Multi-model support: routes to the selected AI model's API
 * Currently supports: Kling, Runway, Luma, Pika, Minimax, HeyGen
 */

const MODEL_CONFIGS = {
  kling: {
    name: "Kling AI",
    envKey: "KLING_API_KEY",
    endpoint: "https://api.klingai.com/v1/videos/text2video",
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.klingai.com/v1/videos/text2video",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        prompt,
        negative_prompt: settings.negative_prompt || "",
        cfg_scale: 0.5,
        mode: settings.quality || "std",
        aspect_ratio: settings.aspect_ratio || "16:9",
        duration: settings.duration || "5",
      },
    }),
  },
  runway: {
    name: "Runway ML",
    envKey: "RUNWAY_API_KEY",
    endpoint: "https://api.dev.runwayml.com/v1/text_to_video",
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.dev.runwayml.com/v1/text_to_video",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: {
        model: "gen4_turbo",
        promptText: prompt,
        duration: parseInt(settings.duration) || 5,
        ratio: settings.aspect_ratio === "9:16" ? "768:1344" : "1344:768",
      },
    }),
  },
  luma: {
    name: "Luma Dream Machine",
    envKey: "LUMA_API_KEY",
    endpoint: "https://api.lumalabs.ai/dream-machine/v1/generations",
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.lumalabs.ai/dream-machine/v1/generations",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        prompt,
        aspect_ratio: settings.aspect_ratio || "16:9",
        loop: false,
      },
    }),
  },
  pika: {
    name: "Pika Labs",
    envKey: "PIKA_API_KEY",
    endpoint: "https://api.pika.art/v1/generate",
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.pika.art/v1/generate",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        prompt,
        style: settings.style || "cinematic",
        aspect_ratio: settings.aspect_ratio || "16:9",
        duration: parseInt(settings.duration) || 3,
      },
    }),
  },
  minimax: {
    name: "Minimax (Hailuo)",
    envKey: "MINIMAX_API_KEY",
    endpoint: "https://api.minimax.chat/v1/video_generation",
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.minimax.chat/v1/video_generation",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: "video-01",
        prompt,
      },
    }),
  },
  heygen: {
    name: "HeyGen",
    envKey: "HEYGEN_API_KEY",
    endpoint: "https://api.heygen.com/v2/video/generate",
    mapRequest: (prompt, settings, apiKey) => {
      let character;
      if (settings.avatar_id) {
        character = {
          type: "avatar",
          avatar_id: settings.avatar_id,
          avatar_style: settings.avatar_style || "normal",
        };
      } else if (settings.talking_photo_id) {
        character = {
          type: "talking_photo",
          talking_photo_id: settings.talking_photo_id,
        };
      } else {
        character = {
          type: "talking_photo",
          talking_photo_url: settings.avatar_url || "",
        };
      }

      return {
        url: "https://api.heygen.com/v2/video/generate",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: {
          video_inputs: [
            {
              character,
              voice: {
                type: "text",
                input_text: prompt,
                voice_id: settings.voice_id || "2d5b0e67a03d40bcad1011d674cc3691", // Default to a standard English voice
              },
            },
          ],
          dimension:
            settings.aspect_ratio === "9:16"
              ? { width: 1080, height: 1920 }
              : { width: 1920, height: 1080 },
        },
      };
    },
  },
  gemini: {
    name: "Google Veo",
    envKey: "GEMINI_API_KEY",
    // Special handling for Gemini as it uses the SDK
    isSDK: true, 
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
    const { prompt, model, settings = {} } = body;

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json(
        { error: "Prompt must be at least 5 characters." },
        { status: 400 }
      );
    }

    if (!model || !MODEL_CONFIGS[model]) {
      return NextResponse.json(
        { error: `Unknown model "${model}". Supported: ${Object.keys(MODEL_CONFIGS).join(", ")}` },
        { status: 400 }
      );
    }

    const config = MODEL_CONFIGS[model];
    const apiKey = process.env[config.envKey];

    // If no API key configured, return a demo/mock response
    if (!apiKey) {
      console.log(`[T2V] No ${config.envKey} configured — returning demo response`);
      return NextResponse.json({
        success: true,
        demo: true,
        model: config.name,
        message: `Demo mode: ${config.envKey} not configured. Add it to .env.local to enable real generation.`,
        video_id: `demo-${Date.now()}`,
        status: "demo",
        prompt: prompt.trim(),
        estimated_time: "30-120 seconds",
      });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "text_to_video",
      metadata: {
        endpoint: "/api/text-to-video",
        model,
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    // SPECIAL HANDLING: Google Gemini (Veo)
    if (config.isSDK && model === "gemini") {
      console.log("[T2V] Initializing Gemini Veo...");
      const ai = new GoogleGenAI({ apiKey });
      
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: prompt.trim(),
        config: {
          aspectRatio: settings.aspect_ratio || "16:9",
          durationSeconds: parseInt(settings.duration) || 5,
        },
      });

      console.log("[T2V] Gemini operation started:", operation.name);

      return NextResponse.json({
        success: true,
        demo: false,
        model: config.name,
        video_id: operation.name,
        status: "processing",
      });
    }

    // Default handling for other models using fetch
    const mapped = config.mapRequest(prompt.trim(), settings, apiKey);

    console.log(`[T2V] Sending to ${config.name}...`);

    const response = await fetch(mapped.url, {
      method: "POST",
      headers: mapped.headers,
      body: JSON.stringify(mapped.body),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error(`[T2V] ${config.name} error:`, response.status, responseData);
      await refundCreditsForAction({
        userId,
        action: "text_to_video",
        debit,
        metadata: {
          endpoint: "/api/text-to-video",
          model,
          reason: "provider_error",
          status: response.status,
        },
      });

      return NextResponse.json(
        {
          error: `${config.name} API error (${response.status}): ${responseData?.error?.message || responseData?.message || "Unknown error"}`,
          model: config.name,
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      demo: false,
      model: config.name,
      data: responseData,
      video_id: responseData?.video_id || responseData?.data?.video_id || responseData?.id || responseData?.task_id || responseData?.generation_id || null,
      status: responseData?.status || responseData?.data?.status || "processing",
    });
  } catch (error) {
    console.error("[T2V] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "text_to_video",
        debit,
        metadata: {
          endpoint: "/api/text-to-video",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Video generation failed" },
      { status: 500 }
    );
  }
}

// GET: Return list of available models and their status
export async function GET() {
  const models = Object.entries(MODEL_CONFIGS).map(([id, config]) => ({
    id,
    name: config.name,
    configured: !!process.env[config.envKey],
    envKey: config.envKey,
  }));

  return NextResponse.json({ models });
}
