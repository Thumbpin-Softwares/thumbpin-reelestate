import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

/**
 * POST /api/real-estate-video/composite
 * Generate a composite image of the avatar standing/presenting inside a property scene.
 * Input: FormData with avatarImage (file) + propertyImage (file) + optional direction (string)
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
    const propertyFile = formData.get("propertyImage");
    const direction = formData.get("direction");

    if (!avatarFile || !propertyFile) {
      return NextResponse.json({ error: "Both avatarImage and propertyImage are required" }, { status: 400 });
    }

    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        data: buffer.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const avatarData = await fileToBase64(avatarFile);
    const propertyData = await fileToBase64(propertyFile);

    const ai = new GoogleGenAI({ apiKey });

    const sceneDirection = direction
      ? direction
      : `The person is standing confidently near the center of the room/space, turned slightly toward the camera with a warm professional smile. One hand is gesturing toward the space around them as if presenting the property. They look like a confident real estate agent inviting you to take a look.`;

    const compositePrompt = `Create a photorealistic image combining these two references into one scene. This should look like a frame from a high-quality real estate spokesperson video.

PERSON (Reference 1): Use this person's EXACT appearance — face, skin tone, hair, body type, clothing. They are a real estate presenter/agent. Do NOT change anything about how they look.

PROPERTY (Reference 2): Use this EXACT property/room as the BACKGROUND SETTING. The person should be STANDING INSIDE this space — it's the actual location they are presenting.

CRITICAL PROPERTY GUARDRAILS:
- The property image must remain EXACTLY the same: same layout, furniture, wall colors, lighting, windows, floor, decor.
- Do NOT add, remove, move, or modify ANY property elements.
- Do NOT change the camera angle, lens perspective, or crop of the property image.
- The ONLY change allowed is placing the person in the scene with realistic occlusion and shadows.

SCENE DIRECTION:
${sceneDirection}

SCENE REQUIREMENTS:
- The person is standing INSIDE the property — they are physically present in this room/space
- Professional real estate presenter body language — confident posture, warm smile, inviting gestures
- The property/room is clearly visible around and behind the person — they are showcasing this space
- Natural lighting that matches the property scene (sunlight from windows, ambient room light)
- Portrait orientation (9:16 aspect ratio) — framed like a vertical video
- Authentic skin textures, professional attire, no airbrushing
- The person takes up about 40-50% of the frame — the property is equally important
- Natural depth of field — person sharp, distant background elements slightly softer
- Warm, aspirational color grading — the property should look inviting and premium

Style: This should look EXACTLY like a screenshot from a professional real estate walthrough video — a confident spokesperson presenting a beautiful property. Premium quality, aspirational, cinematic but approachable. NOT a catalog photo, NOT a headshot.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          parts: [
            { text: compositePrompt },
            { inlineData: avatarData },
            { inlineData: propertyData },
          ],
        },
      ],
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const compositeUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        try {
          await dbConnect();
          await Asset.create({
            userId: session.user.id,
            name: "Real estate composite",
            type: "composite",
            url: compositeUrl,
            metadata: {
              context: "real-estate-video",
              source: "gemini",
            },
          });
        } catch (assetErr) {
          console.error("[RealEstateVideo] Composite asset save failed:", assetErr);
        }

        return NextResponse.json({
          success: true,
          compositeUrl,
        });
      }
    }

    return NextResponse.json({ error: "No image was generated. Please try again." }, { status: 502 });
  } catch (error) {
    console.error("[RealEstateVideo] Composite error:", error);
    return NextResponse.json({ error: error.message || "Composite generation failed" }, { status: 500 });
  }
}
