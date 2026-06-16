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

    const compositePrompt = `You are given two reference images. Your task is to seamlessly PLACE the PERSON into the PROPERTY scene as if they were PHOTOGRAPHED there.

PERSON (Reference 1 — the human):
- Reproduce this person's EXACT appearance: face, skin tone, hair color/style, body type, clothing, accessories.
- Do NOT alter, beautify, age, or stylize them in any way.

PROPERTY IMAGE PRESERVATION (ABSOLUTE — HIGHEST PRIORITY):
- The property/location image (Reference 2) MUST remain 100% UNCHANGED.
- Do NOT modify ANY element: walls, furniture, flooring, lighting, windows, decorations, ceiling, fixtures, shadows, reflections.
- Do NOT change the camera angle, lens perspective, field of view, focal length, or crop.
- Do NOT add or remove ANY objects from the scene (no extra furniture, no extra lighting, no new shadows on walls).
- Do NOT alter the color grading, white balance, exposure, or contrast of the background.
- The ONLY addition to the scene is the person — everything else must be pixel-level identical to the original property image.

GROUND PLACEMENT (CRITICAL — READ CAREFULLY):
- Analyze the property image to locate the GROUND PLANE (floor surface, pavement, grass, tiles, etc.).
- The person's FEET must be planted ON this ground surface — never floating above it, never clipping through it.
- PERSPECTIVE SCALE: The person's size must match the spatial depth of where they stand:
  • If the ground/floor is CLOSE to the camera → the person appears LARGER (foreground presence).
  • If the ground/floor is FAR from the camera → the person appears SMALL (matching the distance).
  • Use surrounding objects (furniture, doors, windows) as scale references — a person standing next to a door should be door-height (~6-7 feet).
- Match the VANISHING POINT and camera perspective — the person's vertical axis must align with the scene's perspective lines.
- The person should be standing at a NATURAL position in the space — not blocking the main focal point, ideally off-center or at a 1/3 composition point.

SCENE DIRECTION:
${sceneDirection}

COMPOSITING REALISM:
- Lighting on the person must match the scene's light sources (window light direction, ambient room light, outdoor sun angle).
- Add a NATURAL shadow under/behind the person that matches the scene's existing shadow direction and softness.
- If foreground objects exist (furniture, railings, plants), the person should be OCCLUDED by them where spatially correct.
- Color temperature and white balance of the person must match the scene (warm indoor = warm skin tones, cool outdoor = cooler tones).
- The person should have the same slight depth-of-field blur as objects at the same distance in the original image.

OUTPUT:
- Portrait orientation (9:16 aspect ratio)
- The person takes up approximately 30-50% of the frame height depending on their distance from camera
- The result must look like the person was ACTUALLY photographed at this location — indistinguishable from a real photograph
- Professional real estate presenter body language — confident posture, warm smile
- Premium quality, photorealistic, no AI artifacts, no uncanny valley effects
- ❌ ABSOLUTELY NO TEXT, NO LABELS, NO PRICE TAGS, NO CAPTIONS, NO WATERMARKS, NO OVERLAYS of any kind — pure clean image only`;

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
