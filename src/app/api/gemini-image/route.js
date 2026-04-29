import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

/**
 * Image Generation API
 * Priority:
 *   1. Gemini 2.5 Flash Image (free, quota-limited)
 *   2. Imagen 4 (paid plans only)
 *   3. Pollinations.ai (free, unlimited, no key needed — always works)
 */

const FLASH_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
];

const IMAGEN_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-4.0-fast-generate-001",
];

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
    const { prompt, count = 1 } = body;

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json(
        { error: "Prompt must be at least 5 characters." },
        { status: 400 }
      );
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "gemini_image_generation",
      metadata: {
        endpoint: "/api/gemini-image",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const apiKey = process.env.GEMINI_API_KEY;
    const images = [];
    const totalToGenerate = Math.min(count, 4);
    let quotaExceeded = false;

    // --- Try Gemini Flash image models first ---
    if (apiKey) {
      for (let i = 0; i < totalToGenerate; i++) {
        if (quotaExceeded) break;
        const result = await tryFlashImageGen(apiKey, prompt.trim());
        if (result === "QUOTA_EXCEEDED") {
          quotaExceeded = true;
          break;
        }
        if (result) images.push(result);
      }

      // Try Imagen 4 if Flash failed (but not from quota)
      if (images.length === 0 && !quotaExceeded) {
        const imagenResult = await tryImagenPredict(apiKey, prompt.trim());
        if (imagenResult) images.push(imagenResult);
      }
    }

    // --- Fallback: Pollinations.ai (free, no key, unlimited) ---
    if (images.length === 0) {
      console.log("[GeminiImg] Using Pollinations.ai fallback (free, unlimited)...");
      for (let i = 0; i < totalToGenerate; i++) {
        const pollResult = await tryPollinations(prompt.trim(), i);
        if (pollResult) images.push(pollResult);
      }
    }

    if (images.length === 0) {
      await refundCreditsForAction({
        userId,
        action: "gemini_image_generation",
        debit,
        metadata: {
          endpoint: "/api/gemini-image",
          reason: "all_methods_failed",
        },
      });

      return NextResponse.json(
        { error: "All image generation methods failed. Please try again." },
        { status: 502 }
      );
    }

    const source = images[0]?.source || "Unknown";
    if (quotaExceeded && source.includes("pollinations")) {
      console.log("[GeminiImg] Gemini quota exceeded, served via Pollinations.ai");
      await refundCreditsForAction({
        userId,
        action: "gemini_image_generation",
        debit,
        metadata: {
          endpoint: "/api/gemini-image",
          reason: "free_fallback_provider",
          provider: "pollinations",
        },
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
            context: "gemini-image",
            source: img.source || source,
          },
        }))
      );
    } catch (assetErr) {
      console.error("[GeminiImg] Asset save failed:", assetErr);
    }

    return NextResponse.json({
      success: true,
      images,
      model: source.includes("pollinations") ? "Pollinations AI (free fallback)" : source,
      quota_note: quotaExceeded
        ? "Gemini free tier quota exceeded. Using Pollinations.ai (free, unlimited). Quota resets daily."
        : undefined,
    });
  } catch (error) {
    console.error("[GeminiImg] Error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "gemini_image_generation",
        debit,
        metadata: {
          endpoint: "/api/gemini-image",
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

// --- Gemini Flash Image gen ---
async function tryFlashImageGen(apiKey, prompt) {
  for (const modelId of FLASH_MODELS) {
    try {
      console.log(`[GeminiImg] Trying ${modelId}...`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || "";
        console.log(`[GeminiImg] ${modelId} failed (${res.status}):`, msg.substring(0, 80));
        if (res.status === 429 || msg.includes("quota")) return "QUOTA_EXCEEDED";
        continue;
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          console.log(`[GeminiImg] Success with ${modelId}!`);
          return {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            source: modelId,
          };
        }
      }
    } catch (err) {
      console.log(`[GeminiImg] ${modelId} exception:`, err.message);
    }
  }
  return null;
}

// --- Imagen 4 (predict, paid plans) ---
async function tryImagenPredict(apiKey, prompt) {
  for (const modelId of IMAGEN_MODELS) {
    try {
      console.log(`[GeminiImg] Trying ${modelId} (predict)...`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: "9:16", personGeneration: "allow_all" },
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.log(`[GeminiImg] ${modelId} failed (${res.status}):`, errData?.error?.message?.substring(0, 80));
        continue;
      }

      const data = await res.json();
      for (const pred of data?.predictions || []) {
        if (pred.bytesBase64Encoded) {
          console.log(`[GeminiImg] Success with ${modelId}!`);
          return { url: `data:image/png;base64,${pred.bytesBase64Encoded}`, source: modelId };
        }
      }
    } catch (err) {
      console.log(`[GeminiImg] ${modelId} exception:`, err.message);
    }
  }
  return null;
}

// --- Pollinations.ai (free, no key, unlimited, generates on-demand) ---
async function tryPollinations(prompt, seed = 0) {
  // Pollinations generates images on-demand when the URL is loaded
  // No need for HEAD check — just return the URL immediately
  const shortPrompt = prompt.substring(0, 200);
  const encodedPrompt = encodeURIComponent(shortPrompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=1024&seed=${seed + Date.now()}&nologo=true&model=flux`;
  console.log(`[GeminiImg] Pollinations.ai URL ready (seed ${seed})`);
  return { url, source: "pollinations-flux" };
}
