import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

/**
 * POST /api/product-video/composite-directions
 * Gemini analyzes the avatar + product and generates 1-3 creative direction prompts
 * for different composite poses/actions/angles.
 * Input: FormData with avatarImage (file) + productImage (file) + variantCount (1-3)
 * Output: { directions: [{ title: string, prompt: string }] }
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
    const variantCount = Math.min(Math.max(parseInt(formData.get("variantCount")) || 2, 1), 3);

    if (!avatarFile || !productFile) {
      return NextResponse.json({ error: "Both avatarImage and productImage are required" }, { status: 400 });
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
    const productData = await fileToBase64(productFile);

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert UGC video creative director.

Look at these two images:
1. A person (the avatar/presenter)
2. A product

I need you to create EXACTLY ${variantCount} different creative direction(s) for composite images where this person is interacting with this product. Each direction should describe a DIFFERENT pose, action, angle, or scenario.

Think like a real Instagram/TikTok creator who would film multiple takes with different energy and angles:

VARIETY IDEAS (pick from these or create similar ones):
- Holding the product up next to their face, excited, looking at camera
- Applying/using the product (if applicable), candid mid-action shot
- Unboxing or revealing the product with a surprised/delighted expression
- Showing the product from a different angle, pointing at a feature
- Casual over-the-shoulder shot looking back at camera while holding product
- Sitting down with product on a table, leaning in to talk about it
- Close-up of hands holding product with face partially visible, smiling
- Walking toward camera holding the product, mid-stride energy

RULES:
1. Each direction must be meaningfully DIFFERENT in pose, action, or camera angle
2. Keep the same person, same product, same indoor UGC setting
3. Each direction should naturally work as a "starting frame" for an 8-second product video
4. Make them feel authentic and natural — real creator vibes, not stock photo poses

Return your response as valid JSON ONLY. No markdown, no explanation. Just the JSON array:
[
  { "title": "Short 3-5 word title", "prompt": "Detailed scene description for image generation..." },
  ...
]

Each prompt should be 2-3 sentences describing the exact pose, expression, product position, camera angle, and energy level. Be very specific.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: avatarData },
            { inlineData: productData },
          ],
        },
      ],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "Failed to generate directions" }, { status: 502 });
    }

    // Parse JSON — handle potential markdown code blocks
    let directions;
    try {
      const jsonStr = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      directions = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[ProductVideo] Failed to parse directions JSON:", rawText);
      // Fallback: generate default directions
      directions = [
        { title: "Excited Product Hold", prompt: "The person holds the product up near their face with one hand, looking directly at camera with a big excited smile and raised eyebrows. Their free hand is mid-gesture, pointing at the product. Warm indoor lighting, UGC selfie style." },
        { title: "Product Close-up Reveal", prompt: "The person holds the product at chest height with both hands, angling it toward the camera to show details. They look down at the product with genuine interest then back up at camera. Soft ring light, casual indoor setting." },
        { title: "Casual Unboxing Energy", prompt: "The person is mid-action of lifting or revealing the product, with a surprised delighted expression. One hand holds the product, the other is in an 'oh my god' gesture. Natural window light, bedroom/living room background." },
      ].slice(0, variantCount);
    }

    // Ensure we have the right count
    directions = directions.slice(0, variantCount);

    return NextResponse.json({ success: true, directions });
  } catch (error) {
    console.error("[ProductVideo] Composite directions error:", error);
    return NextResponse.json({ error: error.message || "Direction generation failed" }, { status: 500 });
  }
}
