import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";

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
  let userId = null;
  let debit = null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[DEBUG] Missing GEMINI_API_KEY");
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.error("[DEBUG] No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;
    console.log(`[DEBUG] User ID: ${userId}`);

    const formData = await request.formData();

    // ── Parse person images ──────────────────────────────────────────────────
    const personFiles = formData.getAll("personImages");
    const locationFiles = formData.getAll("locationImages");
    const scriptPartsRaw = formData.get("scriptParts");
    const context = formData.get("context") || "real-estate";

    console.log(`[DEBUG] personFiles count: ${personFiles.length}`);
    console.log(`[DEBUG] locationFiles count: ${locationFiles.length}`);
    console.log(`[DEBUG] scriptPartsRaw: ${scriptPartsRaw?.substring(0, 100)}...`);
    console.log(`[DEBUG] context: ${context}`);

    if (!scriptPartsRaw) {
      console.error("[DEBUG] Missing scriptParts");
      return NextResponse.json({ error: "scriptParts is required" }, { status: 400 });
    }
    if (!personFiles.length) {
      console.error("[DEBUG] Missing person images");
      return NextResponse.json({ error: "At least 1 person image is required" }, { status: 400 });
    }
    if (!locationFiles.length) {
      console.error("[DEBUG] Missing location images");
      return NextResponse.json({ error: "At least 1 location image is required" }, { status: 400 });
    }

    const scriptParts = JSON.parse(scriptPartsRaw);
    console.log(`[DEBUG] scriptParts array length: ${scriptParts.length}`);
    if (!Array.isArray(scriptParts) || scriptParts.length < 1) {
      console.error("[DEBUG] Invalid scriptParts format");
      return NextResponse.json({ error: "scriptParts must be an array of at least 1 string" }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "ai_walkthrough",
      metadata: {
        endpoint: "/api/ai-walkthrough/generate",
        context,
        scriptPartsCount: scriptParts.length,
      },
    });

    if (!creditResult.ok) {
      console.error("[DEBUG] Credit check failed");
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }

    debit = creditResult.debit;
    console.log(`[DEBUG] Credits consumed, debit: ${debit}`);

    // ── Convert images to base64 ─────────────────────────────────────────────
    async function fileToBase64(file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { 
        imageBytes: buffer.toString("base64"), 
        mimeType: file.type || "image/jpeg" 
      };
    }

    const personImgs = await Promise.all(personFiles.slice(0, 2).map(fileToBase64));
    const locationImgs = await Promise.all(locationFiles.slice(0, 2).map(fileToBase64));
    console.log(`[DEBUG] personImgs converted: ${personImgs.length}`);
    console.log(`[DEBUG] locationImgs converted: ${locationImgs.length}`);

    // ── Allocate reference slots (max 3 total) ───────────────────────────────
    const maxSlots = 3;
    const personSlots = Math.min(personImgs.length, maxSlots - 1);
    const locationSlots = Math.min(locationImgs.length, maxSlots - personSlots);
    console.log(`[DEBUG] personSlots: ${personSlots}, locationSlots: ${locationSlots}`);

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
    console.log(`[DEBUG] referenceImages count: ${referenceImages.length}`);

    // ── SSE stream setup ─────────────────────────────────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          const jsonData = JSON.stringify(data);
          console.log(`[DEBUG] Sending SSE: ${jsonData.substring(0, 200)}`);
          controller.enqueue(encoder.encode(`data: ${jsonData}\n\n`));
        }

        async function pollOperation(initialOperation) {
          let currentOp = initialOperation;
          const timeout = Date.now() + 10 * 60 * 1000; // 10 min timeout
          
          while (currentOp && !currentOp.done) {
            if (Date.now() > timeout) throw new Error("Video generation timed out");
            
            await new Promise((r) => setTimeout(r, 10000)); // Poll every 10s
            console.log(`[DEBUG] Polling video generation...`);            
            const nextOp = await ai.operations.getVideosOperation({ 
              operation: currentOp 
            });
            
            if (!nextOp) {
              console.warn("[DEBUG] Poll returned null/undefined, retrying...");
              continue;
            }
            
            currentOp = nextOp;
          }
          
          if (!currentOp) throw new Error("Operation lost during polling");
          
          if (currentOp.error) {
            const msg = currentOp.error.message || "";
            console.error(`[DEBUG] Operation error: ${msg}`);
            throw new Error(msg || "Operation failed");
          }
          console.log(`[DEBUG] Operation complete!`);
          return currentOp.response;
        }

        try {
          const fullScript = scriptParts.join(" ");
          console.log(`[DEBUG] fullScript length: ${fullScript.length}`);
          
          send({ 
            type: "progress", 
            videoIndex: 0, 
            status: "generating", 
            message: "Directing cinematic walkthrough with Veo..." 
          });

          const prompt = buildPrompt(fullScript, true, context);
          console.log(`[DEBUG] Prompt built, length: ${prompt.length}`);
          
          console.log(`[DEBUG] Calling generateVideos with Veo...`);
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
          console.log(`[DEBUG] Generation started, operation ID: ${generationOp.name}`);

          // Polling
          const result = await pollOperation(generationOp);
          console.log(`[DEBUG] Got result from pollOperation`);

          const generatedVideo = result.generatedVideos?.[0]?.video;
          if (!generatedVideo) throw new Error("Video generation returned no video");
          
          console.log(`[DEBUG] generatedVideo.uri: ${generatedVideo.uri}`);

          // Extract fileId from uri
          const uriParts = generatedVideo.uri.split("/");
          const fileName = uriParts.pop() || "";
          const fileId = fileName.split(":")[0].split("?")[0];
          console.log(`[DEBUG] Extracted fileId: ${fileId}`);
          
          const videoUrl = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;
          console.log(`[DEBUG] Gemini proxy URL: ${videoUrl}`);

          // ── Download from Gemini & upload to R2 ────────────────────────────
          let persistedVideoUrl = videoUrl; // fallback: ephemeral proxy
          try {
            console.log(`[DEBUG] Attempting to download video from Gemini...`);
            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?key=${apiKey}&alt=media`;
            console.log(`[DEBUG] Download URL: ${downloadUrl}`);
            
            const videoResp = await fetch(downloadUrl);
            console.log(`[DEBUG] Download response status: ${videoResp.status}`);
            
            if (videoResp.ok) {
              const videoBytes = Buffer.from(await videoResp.arrayBuffer());
              console.log(`[DEBUG] Downloaded video size: ${(videoBytes.length / 1024 / 1024).toFixed(2)} MB`);
              
              const key = buildUserKey(userId, "videos", "mp4", "ai-walkthrough");
              console.log(`[DEBUG] R2 key: ${key}`);
              
              console.log(`[DEBUG] Uploading to R2...`);
              persistedVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
              console.log(`[DEBUG] R2 upload complete!`);
              console.log(`[DEBUG] ===== VIDEO URL DEBUG =====`);
              console.log(`[DEBUG] persistedVideoUrl: ${persistedVideoUrl}`);
              console.log(`[DEBUG] Is proxy URL? ${persistedVideoUrl?.startsWith('/api/r2/user')}`);
              console.log(`[DEBUG] Full URL: ${persistedVideoUrl}`);
              console.log(`[DEBUG] ===========================`);
              
              // Test if the proxy URL is accessible
              try {
                const testUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${persistedVideoUrl}`;
                console.log(`[DEBUG] Test URL: ${testUrl}`);
              } catch (testErr) {
                console.log(`[DEBUG] Cannot test URL (no base URL configured)`);
              }
            } else {
              console.error(`[DEBUG] Download failed with status: ${videoResp.status}`);
            }
          } catch (uploadErr) {
            console.error(`[DEBUG] R2 upload failed:`, uploadErr.message);
            console.error(`[DEBUG] Stack:`, uploadErr.stack);
          }

          console.log(`[DEBUG] Sending video_ready event with URL: ${persistedVideoUrl}`);
          send({
            type: "video_ready",
            videoIndex: 0,
            videoUrl: persistedVideoUrl,
            isLast: true,
          });

          // Save to Asset Library
          try {
            console.log(`[DEBUG] Saving to Asset Library...`);
            await dbConnect();
            const asset = await Asset.create({
              userId: session.user.id,
              name: `AI Walkthrough - ${new Date().toLocaleDateString()}`,
              url: persistedVideoUrl,
              type: "clip",
              metadata: {
                fileId,
                source: "veo",
                context: context
              }
            });
            console.log(`[DEBUG] Asset created with ID: ${asset._id}`);
            console.log(`[DEBUG] Asset URL: ${asset.url}`);
          } catch (dbErr) {
            console.error(`[DEBUG] DB Error:`, dbErr);
          }

          console.log(`[DEBUG] Sending done event`);
          send({ type: "done", totalVideos: 1 });
          controller.close();
          console.log(`[DEBUG] Stream closed successfully`);
        } catch (err) {
          console.error(`[DEBUG] Generation error:`, err);
          console.error(`[DEBUG] Error stack:`, err.stack);

          if (userId && debit) {
            console.log(`[DEBUG] Refunding credits...`);
            await refundCreditsForAction({
              userId,
              action: "ai_walkthrough",
              debit,
              metadata: {
                endpoint: "/api/ai-walkthrough/generate",
                reason: "generation_failed",
                message: err.message,
              },
            });
          }

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
    console.error("[DEBUG] Outer catch error:", error);
    console.error("[DEBUG] Error stack:", error.stack);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "ai_walkthrough",
        debit,
        metadata: {
          endpoint: "/api/ai-walkthrough/generate",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

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