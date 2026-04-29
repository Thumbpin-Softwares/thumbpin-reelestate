import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

/**
 * POST /api/product-video/composite
 * Generate a composite image of the avatar holding/presenting the product.
 * Input: FormData with avatarImage (file) + productImage (file) + optional direction (string)
 * Output: { compositeUrl: "data:image/png;base64,..." }
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const avatarFile = formData.get("avatarImage");
    const productFile = formData.get("productImage");
    const direction = formData.get("direction"); // Optional creative direction

    if (!avatarFile || !productFile) {
      return NextResponse.json({ error: "Both avatarImage and productImage are required" }, { status: 400 });
    }

    // Convert files to base64
    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        data: buffer.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const avatarData = await fileToBase64(avatarFile);
    const productData = await fileToBase64(productFile);

    const ai = new GoogleGenAI({ apiKey });

    // Use the provided creative direction or fall back to default
    const sceneDirection = direction
      ? direction
      : `The person is looking directly at the camera with an EXCITED, animated expression — big genuine smile, raised eyebrows, like they just discovered their new favorite thing and can't wait to tell you about it. They hold the product up near their face/chest with one hand, slightly angled toward camera to show it off. Their free hand is mid-gesture — pointing at the product, or doing an animated "oh my god" gesture.`;

    const compositePrompt = `Create a photorealistic image combining these two references into one scene. This should look like a screenshot from a popular UGC creator's product review video.

PERSON (Reference 1): Use this person's EXACT appearance — face, skin tone, hair, body type, clothing. They should be the main subject. Do NOT change anything about how they look.

PRODUCT (Reference 2): Use this EXACT product. It must be clearly recognizable.

SCENE DIRECTION:
${sceneDirection}

SCENE REQUIREMENTS:
- UGC-style casual indoor setting — bedroom, living room, or kitchen with warm ring light or window lighting
- Portrait orientation (9:16 aspect ratio)
- Authentic skin textures, no airbrushing, natural makeup if any
- The product should be clearly visible, well-lit, and the second focal point after their face
- Natural, candid body language
- Clean, slightly blurred cozy background (shallow depth of field)
- Warm color grading — inviting, Instagram-ready tones

Style: This should look EXACTLY like a selfie screenshot from an Instagram Reel or TikTok — a real person genuinely excited about a product. NOT a catalog photo, NOT a corporate headshot.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          parts: [
            { text: compositePrompt },
            { inlineData: avatarData },
            { inlineData: productData },
          ],
        },
      ],
    });

    // Extract the generated image
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const compositeUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        try {
          await dbConnect();
          await Asset.create({
            userId: session.user.id,
            name: "Product composite",
            type: "composite",
            url: compositeUrl,
            metadata: {
              context: "product-video",
              source: "gemini",
            },
          });
        } catch (assetErr) {
          console.error("[ProductVideo] Composite asset save failed:", assetErr);
        }

        return NextResponse.json({
          success: true,
          compositeUrl,
        });
      }
    }

    return NextResponse.json({ error: "No image was generated. Please try again." }, { status: 502 });
  } catch (error) {
    console.error("[ProductVideo] Composite error:", error);
    return NextResponse.json({ error: error.message || "Composite generation failed" }, { status: 500 });
  }
}
