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
    const { prompt, variants = 3 } = body;

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

    const angleVariants = [
      "facing the camera directly, front view, chest-up portrait",
      "three-quarter view, slightly turned to the side (45 degrees), looking toward camera, chest-up",
      "side profile view in quarter turn (70-80 degrees), looking slightly toward camera, chest-up"
    ];

    const images = [];
    const errors = [];

    // Use Promise.all for parallel generation
    const generationPromises = [];

    for (let i = 0; i < numVariants; i++) {
      const angleDescription = angleVariants[i % angleVariants.length];
      const avatarPrompt = `A photorealistic portrait photo of ${prompt.trim()}. The person is ${angleDescription}, with a warm and confident expression. Natural lighting, clean background, authentic skin textures, realistic facial features. High-quality photograph style, suitable for a product spokesperson. No text, no watermarks.`;

      console.log(`[ProductVideo] Generating avatar ${i + 1} with prompt:`, avatarPrompt.substring(0, 100) + "...");

      const promise = ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: avatarPrompt,
      })
      .then(response => {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              variant: i + 1,
              angle: i === 0 ? "front" : i === 1 ? "three-quarter" : "side"
            };
          }
        }
        throw new Error(`No inlineData found for variant ${i + 1}`);
      })
      .catch(err => {
        console.error(`[ProductVideo] Variant ${i + 1} failed:`, err.message);
        errors.push({ variant: i + 1, error: err.message });
        return null;
      });

      generationPromises.push(promise);
    }

    // Wait for all generations to complete
    const results = await Promise.all(generationPromises);
    
    // Filter out failed generations
    for (const result of results) {
      if (result) {
        images.push(result);
      }
    }

    console.log(`[ProductVideo] Generated ${images.length}/${numVariants} avatars. Errors:`, errors.length);

    if (images.length === 0) {
      await refundCreditsForAction({
        userId,
        action: "product_avatar_image",
        debit,
        metadata: {
          endpoint: "/api/product-video/generate-avatar",
          reason: "empty_result",
          errors: errors
        },
      });

      return NextResponse.json({ 
        error: "Failed to generate any avatar images. Please try again.",
        details: errors 
      }, { status: 502 });
    }

    // Save only successfully generated images
    try {
      await dbConnect();
      if (images.length > 0) {
        await Asset.insertMany(
          images.map((img, index) => ({
            userId,
            name: `Avatar ${img.angle} view ${index + 1}`,
            type: "avatar",
            url: img.url,
            metadata: {
              context: "product-video-avatar",
              source: "gemini",
              angle: img.angle,
            },
          }))
        );
      }
    } catch (assetErr) {
      console.error("[ProductVideo] Avatar asset save failed:", assetErr);
    }

    return NextResponse.json({ 
      success: true, 
      images,
      generated: images.length,
      total_requested: numVariants,
      errors: errors.length > 0 ? errors : undefined
    });
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