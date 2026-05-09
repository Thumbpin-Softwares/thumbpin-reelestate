import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import Asset from "@/models/Asset";

/**
 * POST /api/product-video/composite
 * Generate composite images for each avatar angle holding/presenting the product.
 * Input: FormData with avatarImages (multiple files) + productImage (file) + propertyBrief (JSON string) + optional direction
 * Output: { composites: [{ url, angle, variant, title }] }
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
    const avatarFiles = formData.getAll("avatarImages");
    const productFile = formData.get("productImage");
    const direction = formData.get("direction");
    const propertyBriefRaw = formData.get("propertyBrief");
    
    // Parse property brief
    let propertyBrief = {};
    if (propertyBriefRaw) {
      try {
        propertyBrief = JSON.parse(propertyBriefRaw);
      } catch (e) {
        console.error("Failed to parse propertyBrief:", e);
      }
    }

    if (!avatarFiles || avatarFiles.length === 0 || !productFile) {
      return NextResponse.json({ error: "At least one avatar and product image are required" }, { status: 400 });
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

    // Convert all avatars and product to base64
    const avatarDataList = await Promise.all(
      avatarFiles.map(file => fileToBase64(file))
    );
    const productData = await fileToBase64(productFile);

    const ai = new GoogleGenAI({ apiKey });

    // Define angles based on order
    const angles = ["front", "three-quarter", "side"];
    
    // Build property description from brief
    const propertyDescription = propertyBrief?.description || "Real estate property";
    const propertyDetails = [
      propertyBrief?.location ? `📍 Location: ${propertyBrief.location}` : null,
      propertyBrief?.price ? `💰 Price: ${propertyBrief.price}` : null,
      propertyBrief?.bedrooms ? `🛏️ Bedrooms: ${propertyBrief.bedrooms}` : null,
      propertyBrief?.bathrooms ? `🛁 Bathrooms: ${propertyBrief.bathrooms}` : null,
      propertyBrief?.area ? `📐 Area: ${propertyBrief.area}` : null,
    ].filter(Boolean).join("\n");
    
    // Default scene direction if not provided
    const defaultDirection = `The person is looking directly at the camera with an EXCITED, animated expression — big genuine smile, raised eyebrows, like they just discovered their new favorite thing and can't wait to tell you about it. They hold the product up near their face/chest with one hand, slightly angled toward camera to show it off. Their free hand is mid-gesture — pointing at the product, or doing an animated "oh my god" gesture.`;
    
    const sceneDirection = direction || defaultDirection;
    
    // Array to store all composite results
    const composites = [];
    
    // Generate a composite for EACH avatar angle
    for (let i = 0; i < avatarDataList.length; i++) {
      const avatarData = avatarDataList[i];
      const angle = i < angles.length ? angles[i] : `angle-${i + 1}`;
      
      console.log(`[ProductVideo] Generating composite ${i + 1}/${avatarDataList.length} (${angle} angle)`);
      
      // Customize prompt based on angle
      const angleSpecificGuidance = i === 0 
        ? "FRONT VIEW: Person facing camera directly, holding product at chest level."
        : i === 1 
        ? "THREE-QUARTER VIEW: Person slightly turned (45°), product held naturally toward camera."
        : "SIDE PROFILE: Person in partial profile, product displayed prominently near face/chest.";
      
      const compositePrompt = `Create a photorealistic image combining these two references into one scene. This should look like a screenshot from a popular UGC creator's product review video.

${angleSpecificGuidance}

PROPERTY DETAILS:
${propertyDescription}
${propertyDetails}

PERSON (Reference 1): Use this person's EXACT appearance from this image — face, skin tone, hair, body type, clothing, and CRITICALLY the ANGLE/ORIENTATION of their face and body. They should be the main subject. Do NOT change their pose angle — preserve whether they're facing forward, turned, or in profile.

PRODUCT/PROPERTY (Reference 2): Use this EXACT property image. It must be clearly recognizable behind or beside the person, or overlaid as a showcase image.

SCENE DIRECTION:
${sceneDirection}

SCENE REQUIREMENTS:
- UGC-style casual indoor setting — bedroom, living room, or kitchen with warm ring light or window lighting
- Portrait orientation (9:16 aspect ratio)
- The property should be clearly visible, well-lit, and the second focal point after the person's face
- Natural, candid body language
- Clean, slightly blurred cozy background (shallow depth of field)
- Warm color grading — inviting, Instagram-ready tones

Style: This should look EXACTLY like a selfie screenshot from an Instagram Reel or TikTok — a real person genuinely excited about the property. NOT a catalog photo, NOT a corporate headshot.`;

      try {
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
        let compositeUrl = null;
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            compositeUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }

        if (compositeUrl) {
          const compositeData = {
            url: compositeUrl,
            angle: angle,
            variant: i + 1,
            avatarIndex: i,
            title: `${angle.charAt(0).toUpperCase() + angle.slice(1)} Angle`,
            propertyIndex: 0
          };
          
          composites.push(compositeData);
          
          // Save each composite to database
          try {
            await dbConnect();
            await Asset.create({
              userId: session.user.id,
              name: `${propertyBrief?.location || "Property"} composite - ${angle} angle`,
              type: "composite",
              url: compositeUrl,
              metadata: {
                context: "product-video",
                source: "gemini",
                angle: angle,
                propertyBrief: propertyBrief
              },
            });
          } catch (assetErr) {
            console.error(`[ProductVideo] Failed to save composite ${angle}:`, assetErr);
          }
        } else {
          console.error(`[ProductVideo] No image generated for ${angle} angle`);
        }
        
      } catch (genErr) {
        console.error(`[ProductVideo] Failed to generate composite for ${angle}:`, genErr.message);
        // Continue with other angles even if one fails
      }
    }

    if (composites.length === 0) {
      return NextResponse.json({ 
        error: "Failed to generate any composites. Please try again." 
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      composites: composites,
      totalGenerated: composites.length,
      totalRequested: avatarDataList.length
    });
    
  } catch (error) {
    console.error("[ProductVideo] Composite error:", error);
    return NextResponse.json({ error: error.message || "Composite generation failed" }, { status: 500 });
  }
}