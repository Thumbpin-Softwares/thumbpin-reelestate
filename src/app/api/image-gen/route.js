import { NextResponse } from "next/server";
import { resolveUserFromSession } from "@/lib/user-resolver";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

/**
 * Image Generation API — Multi-model support
 * Supports: DALL-E 3, Stability AI, Flux (fal.ai), Google Imagen (Gemini)
 */

const MODEL_CONFIGS = {
  "dall-e": {
    name: "DALL-E 3",
    envKey: "OPENAI_API_KEY",
    maxVariants: 4,
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.openai.com/v1/images/generations",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: "dall-e-3",
        prompt,
        n: Math.min(settings.variants || 1, 1), // DALL-E 3 only supports n=1
        size: settings.size || "1024x1024",
        quality: settings.quality || "standard",
        style: settings.style || "vivid",
      },
      parseResponse: (data) =>
        (data.data || []).map((img) => ({
          url: img.url,
          revised_prompt: img.revised_prompt,
        })),
    }),
  },
  stability: {
    name: "Stability AI",
    envKey: "STABILITY_API_KEY",
    maxVariants: 4,
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://api.stability.ai/v2beta/stable-image/generate/sd3",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      isFormData: true,
      formFields: {
        prompt,
        output_format: "png",
        aspect_ratio: settings.aspect_ratio || "1:1",
        mode: "text-to-image",
      },
      parseResponse: (data) =>
        (data.image ? [{ url: `data:image/png;base64,${data.image}` }] : []),
    }),
  },
  flux: {
    name: "Flux (fal.ai)",
    envKey: "FAL_API_KEY",
    maxVariants: 4,
    mapRequest: (prompt, settings, apiKey) => ({
      url: "https://queue.fal.run/fal-ai/flux/dev",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        prompt,
        image_size: settings.size || "landscape_4_3",
        num_images: Math.min(settings.variants || 2, 4),
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
      parseResponse: (data) =>
        (data.images || []).map((img) => ({
          url: img.url,
          width: img.width,
          height: img.height,
        })),
    }),
  },
  gemini: {
    name: "Gemini 2.5 Flash Image",
    mapRequest: (prompt, settings, apiKey) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      headers: { "Content-Type": "application/json" },
      body: {
        contents: [
          {
            parts: [
              { text: `Generate an image: ${prompt}` },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      },
      parseResponse: (data) => {
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const images = [];
        for (const part of parts) {
          if (part.inlineData) {
            images.push({
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            });
          }
        }
        return images;
      },
    }),
  },
};

export async function POST(request) {
  let userId = null;
  let debit = null;

  try {
    const user = await resolveUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user._id.toString();

    const body = await request.json();
    const { prompt, model = "dall-e", settings = {} } = body;

    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: "Prompt must be at least 3 characters." },
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

    // Demo mode if no API key
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        demo: true,
        model: config.name,
        message: `${config.envKey} not configured. Add it to .env.local to enable real generation.`,
        images: getDemoImages(prompt, settings.variants || 2),
      });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "image_generation",
      metadata: {
        endpoint: "/api/image-gen",
        model,
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const mapped = config.mapRequest(prompt.trim(), settings, apiKey);

    let response;
    if (mapped.isFormData) {
      const formData = new FormData();
      Object.entries(mapped.formFields).forEach(([k, v]) => formData.append(k, v));
      response = await fetch(mapped.url, {
        method: "POST",
        headers: mapped.headers,
        body: formData,
      });
    } else {
      response = await fetch(mapped.url, {
        method: "POST",
        headers: mapped.headers,
        body: JSON.stringify(mapped.body),
      });
    }

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[ImageGen] ${config.name} error:`, response.status, responseData);
      await refundCreditsForAction({
        userId,
        action: "image_generation",
        debit,
        metadata: {
          endpoint: "/api/image-gen",
          model,
          reason: "provider_error",
          status: response.status,
        },
      });

      return NextResponse.json(
        { error: `${config.name} error (${response.status}): ${responseData?.error?.message || "Unknown error"}` },
        { status: 502 }
      );
    }

    const images = mapped.parseResponse(responseData);

    if (!images.length) {
      await refundCreditsForAction({
        userId,
        action: "image_generation",
        debit,
        metadata: {
          endpoint: "/api/image-gen",
          model,
          reason: "empty_result",
        },
      });

      return NextResponse.json({
        success: true,
        demo: true,
        model: config.name,
        message: "No images returned. Using demo placeholders.",
        images: getDemoImages(prompt, settings.variants || 2),
      });
    }

    try {
      await dbConnect();
      await Asset.insertMany(
        images.map((img, index) => ({
          userId,
          name: `Generated image ${index + 1}`,
          type: "image",
          url: img.url,
          metadata: {
            context: "image-gen",
            model: config.name,
            source: "generator",
          },
        }))
      );
    } catch (assetErr) {
      console.error("[ImageGen] Asset save failed:", assetErr);
    }

    return NextResponse.json({
      success: true,
      demo: false,
      model: config.name,
      images,
    });
  } catch (error) {
    console.error("[ImageGen] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "image_generation",
        debit,
        metadata: {
          endpoint: "/api/image-gen",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Image generation failed" },
      { status: 500 }
    );
  }
}

// GET: available models
export async function GET() {
  const models = Object.entries(MODEL_CONFIGS).map(([id, config]) => ({
    id,
    name: config.name,
    configured: !!process.env[config.envKey],
    envKey: config.envKey,
    maxVariants: config.maxVariants,
  }));
  return NextResponse.json({ models });
}

// Generate demo placeholder images using picsum with seed from prompt
function getDemoImages(prompt, count = 2) {
  const seed = prompt.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return Array.from({ length: Math.min(count, 4) }, (_, i) => ({
    url: `https://picsum.photos/seed/${seed + i}/1024/1024`,
    demo: true,
  }));
}
