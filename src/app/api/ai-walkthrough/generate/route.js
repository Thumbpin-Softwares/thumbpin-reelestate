import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Video from "@/models/Video";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/db";

/**
 * POST /api/ai-walkthrough/generate
 * Generates 3-4 sequential Veo videos using reference images + script parts.
 * Streams responses via SSE so the client sees each video as it completes.
 *
 * Body: multipart/form-data
 *   personImages[]  — 1 or 2 image files (the person)
 *   locationImages[] — 1 or 2 image files (surroundings / background)
 *   scriptParts     — JSON string: array of 3-4 script snippet strings
 */
export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });


  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    // ── Parse person images ──────────────────────────────────────────────────
    const personFiles = formData.getAll("personImages");
    const locationFiles = formData.getAll("locationImages");
    const scriptPartsRaw = formData.get("scriptParts");
    const context = formData.get("context") || "real-estate"; // Default to real-estate

    if (!scriptPartsRaw) {
      return NextResponse.json({ error: "scriptParts is required" }, { status: 400 });
    }
    if (!personFiles.length) {
      return NextResponse.json({ error: "At least 1 person image is required" }, { status: 400 });
    }
    if (!locationFiles.length) {
      return NextResponse.json({ error: "At least 1 location image is required" }, { status: 400 });
    }

    const scriptParts = JSON.parse(scriptPartsRaw);
    if (!Array.isArray(scriptParts) || scriptParts.length < 1) {
      return NextResponse.json({ error: "scriptParts must be an array of at least 1 string" }, { status: 400 });
    }

    // ── Convert images to base64 ─────────────────────────────────────────────
    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // SDK expects { imageBytes, mimeType } based on usinggemini.txt
      return { 
        imageBytes: buffer.toString("base64"), 
        mimeType: file.type || "image/jpeg" 
      };
    }

    const personImgs = await Promise.all(personFiles.slice(0, 2).map(fileToBase64));
    const locationImgs = await Promise.all(locationFiles.slice(0, 2).map(fileToBase64));

    // ── Allocate reference slots (max 3 total) ───────────────────────────────
    // Priority: person first, then fill remaining with location
    const maxSlots = 3;
    const personSlots = Math.min(personImgs.length, maxSlots - 1); // leave at least 1 for location
    const locationSlots = Math.min(locationImgs.length, maxSlots - personSlots);

    const referenceImages = [
      ...personImgs.slice(0, personSlots).map((img) => ({
        image: img,
        referenceType: "asset",
      })),
      ...locationImgs.slice(0, locationSlots).map((img) => ({
        image: img,
        referenceType: "asset",
      })),
    ];

    // ── SSE stream setup ─────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        async function pollOperation(initialOperation) {
          let currentOp = initialOperation;
          const timeout = Date.now() + 10 * 60 * 1000; // 10 min timeout
          
          while (currentOp && !currentOp.done) {
            if (Date.now() > timeout) throw new Error("Video generation timed out");
            
            await new Promise((r) => setTimeout(r, 10000)); // Poll every 10s
            
            // Passing the full operation object is the documented way for the Node SDK
            const nextOp = await ai.operations.getVideosOperation({ 
              operation: currentOp 
            });
            
            if (!nextOp) {
              console.warn("[AI Walkthrough] Poll returned null/undefined, retrying with previous state...");
              continue;
            }
            
            currentOp = nextOp;
          }
          
          if (!currentOp) throw new Error("Operation lost during polling");
          
          if (currentOp.error) {
            const msg = currentOp.error.message || "";
            if (msg.includes("internal server issue")) {
              throw new Error("Gemini encountered a transient internal error. Please try again in 1-2 minutes.");
            }
            throw new Error(msg || "Operation failed");
          }
          return currentOp.response;
        }

        try {
          const fullScript = scriptParts.join(" ");
          send({ 
            type: "progress", 
            videoIndex: 0, 
            status: "generating", 
            message: "Directing cinematic walkthrough with Veo..." 
          });

          const prompt = buildPrompt(fullScript, true, context);
          
          const generationOp = await ai.models.generateVideos({
            model: "veo-3.1-generate-preview",
            prompt,
            config: {
              aspectRatio: "9:16",
              durationSeconds: 8,
              resolution: "720p",
              personGeneration: "allow_adult",
              referenceImages,
            },
          });

          if (!generationOp) {
            throw new Error("Failed to start generation operation");
          }

          // Polling
          const result = await pollOperation(generationOp);

          const generatedVideo = result.generatedVideos?.[0]?.video;
          if (!generatedVideo) throw new Error("Video generation returned no video");

          // Extract fileId from uri (usually looks like ".../files/xxx" or ".../files/xxx:download")
          // We only want the base ID "xxx"
          const uriParts = generatedVideo.uri.split("/");
          const fileName = uriParts.pop() || "";
          const fileId = fileName.split(":")[0].split("?")[0];
          const videoUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;

          send({
            type: "video_ready",
            videoIndex: 0,
            videoUrl,
            isLast: true,
          });

          // Save to Asset Library
          try {
            await dbConnect();
            await Asset.create({
              userId: session.user.id,
              name: `AI Walkthrough - ${new Date().toLocaleDateString()}`,
              url: videoUrl, // Note: This is an internal proxy URL
              type: "clip",
              metadata: {
                fileId,
                source: "veo",
                context: context
              }
            });
            console.log("[AI Walkthrough] Created asset for video:", fileId);
          } catch (dbErr) {
            console.error("[AI Walkthrough] DB Error:", dbErr);
          }

          send({ type: "done", totalVideos: 1 });
          controller.close();
        } catch (err) {
          console.error("[AI Walkthrough] REST Generation error:", err);
          send({ type: "error", message: err.message || "Video generation failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI Walkthrough] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to start generation" }, { status: 500 });
  }
}

/**
 * High-quality realism tokens from the master creative SOP.
 */
const SKIN_ENHANCER_TOKENS = `Photorealistic detail. Real human skin with visible natural texture, pores, and micro shadows. Preserve natural under-eye detail and realistic lip texture. No airbrushing or waxy finish. Authentic facial structure with natural micro-expressions and eye depth. Lighting behaves naturally with soft highlights and realistic shadows. High-detail editorial realism, grounded in real-world 4k camera capture.`;

/**
 * Build a cinematic Veo prompt from a script part.
 */
function buildPrompt(scriptPart, isFirst, context = "real-estate") {
  const isProduct = context === "product";

  const masterBase = isProduct
    ? `High-end commercial product showcase video in 9:16 portrait. Cinematic studio lighting, sharp focus on the product, sophisticated product photography style, 4k photorealistic detail. The professional presenter (as seen in reference) stands confidently with the product (as seen in reference), gesturing naturally to highlight its features. They are speaking directly to the camera with natural micro-expressions and eye movement. ${SKIN_ENHANCER_TOKENS}`
    : `High-end luxury real estate walkthrough video in 9:16 portrait. Cinematic lighting, soft natural sunlight, shallow depth of field, 4k photorealistic detail. The professional agent (as seen in reference) walks through the property with a warm, confident smile, gesturing naturally to the surroundings. They are speaking directly to the camera with natural micro-expressions and eye movement. ${SKIN_ENHANCER_TOKENS}`;

  if (isFirst) {
    const action = isProduct ? "presenting the product" : "smooth tracking shot";
    return `${masterBase} The video opens with a ${action}. The presenter looks at the camera and speaks clearly: "${scriptPart}". Everything looks crisp, premium, and professional. High-quality synchronized audio.`;
  }
  
  return `SEAMLESS CONTINUITY: ${masterBase} The presenter continues their presentation and speech naturally without any jump cuts, continuing their message: "${scriptPart}". Maintain identical appearance of the person, clothing, and the ${isProduct ? "product and studio setting" : "high-end property interior"}. Smooth motion continues. High-quality synchronized audio.`;
}
