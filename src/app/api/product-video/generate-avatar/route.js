import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

/**
 * POST /api/product-video/generate-avatar
 * Generate AI avatar images using Gemini Nano Banana (gemini-3.1-flash-image-preview).
 * Input: { prompt: string, variants: 1|2|3 }
 * Output: { images: [{ url: "data:image/png;base64,..." }] }
 */
export async function POST(request) {
  let userId = null;
  let debit = null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

    const body = await request.json();
    const { prompt, variants = 1 } = body;

    if (!prompt || prompt.trim().length < 10) {
      return NextResponse.json({ error: "Prompt must be at least 10 characters." }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "product_avatar_image",
      metadata: {
        endpoint: "/api/product-video/generate-avatar",
      },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;

    const numVariants = Math.min(Math.max(parseInt(variants) || 1, 1), 3);
    const ai = new GoogleGenAI({ apiKey });

    // Build a detailed avatar prompt from the user's input
    const avatarPrompt = `A photorealistic portrait photo of ${prompt.trim()}. The person is facing the camera directly, making steady eye contact, with a warm and confident expression. Natural lighting, clean background, shot from chest-up. Authentic skin textures, realistic facial features. High-quality photograph style, suitable for a product spokesperson. No text, no watermarks.`;

    const images = [];

    for (let i = 0; i < numVariants; i++) {
      try {
        // Add slight variation to each prompt for different results
        const variantPrompt = i === 0
          ? avatarPrompt
          : `${avatarPrompt} Variation ${i + 1}: slightly different pose and expression.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image-preview",
          contents: variantPrompt,
        });

        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            images.push({
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              variant: i + 1,
            });
            break; // One image per variant
          }
        }
      } catch (variantErr) {
        console.error(`[ProductVideo] Avatar variant ${i + 1} failed:`, variantErr.message);
        // Continue to next variant
      }
    }

    if (images.length === 0) {
      await refundCreditsForAction({
        userId,
        action: "product_avatar_image",
        debit,
        metadata: {
          endpoint: "/api/product-video/generate-avatar",
          reason: "empty_result",
        },
      });

      return NextResponse.json({ error: "Failed to generate any avatar images. Please try again." }, { status: 502 });
    }

    try {
      await dbConnect();
      await Asset.insertMany(
        images.map((img, index) => ({
          userId,
          name: `Generated avatar ${index + 1}`,
          type: "avatar",
          url: img.url,
          metadata: {
            context: "product-video-avatar",
            source: "gemini",
          },
        }))
      );
    } catch (assetErr) {
      console.error("[ProductVideo] Avatar asset save failed:", assetErr);
    }

    return NextResponse.json({ success: true, images });
  } catch (error) {
    console.error("[ProductVideo] Generate avatar error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "product_avatar_image",
        debit,
        metadata: {
          endpoint: "/api/product-video/generate-avatar",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json({ error: error.message || "Avatar generation failed" }, { status: 500 });
  }
}
