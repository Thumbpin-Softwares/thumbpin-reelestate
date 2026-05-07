import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import { KlingAPI } from "@/lib/kling-api";
import { GoogleGenAI } from "@google/genai";

/**
 * POST /api/real-estate-video/kling-pipeline
 * Kling-powered long video generation with consistency and extensions.
 */
export async function POST(request) {
  let userId = null;
  let debit = null;

  const klingKey = process.env.KLING_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!klingKey) {
    return NextResponse.json({ error: "KLING_API_KEY is not configured" }, { status: 500 });
  }

  const kling = new KlingAPI(klingKey);
  const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

    const formData = await request.formData();
    const compositeFile = formData.get("compositeImage");
    const compositeImageUrl = formData.get("compositeImageUrl");
    const script = formData.get("script");
    const targetDuration = parseInt(formData.get("duration")) || 10; // Default to 10s
    const gestureStyle = formData.get("gestureStyle") || "Professional";
    const propertyDetails = formData.get("propertyDetails"); // Optional JSON string
    const voiceId = formData.get("voiceId");
    const avatarId = formData.get("avatarId");

    if ((!compositeFile && !compositeImageUrl) || !script) {
      return NextResponse.json({ error: "compositeImage/URL and script are required" }, { status: 400 });
    }

    // Credits
    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video_kling",
      metadata: { endpoint: "/api/real-estate-video/kling-pipeline" },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    // Resolve image
    let base64Image = compositeImageUrl;
    let imageBuffer = null;

    if (compositeFile && compositeFile instanceof Blob) {
      const arrayBuffer = await compositeFile.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      base64Image = `data:${compositeFile.type || "image/jpeg"};base64,${imageBuffer.toString("base64")}`;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          // --- Step 1: Voice Prompt (Gemini) ---
          let voicePrompt = "Warm, authoritative, professional real estate presenter.";
          if (ai && imageBuffer) {
            send({ type: "progress", status: "voice", message: "🎙️ Crafting premium voice characteristics..." });
            try {
              voicePrompt = await generateVoicePromptInternal(ai, { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" }, script, propertyDetails);
            } catch (e) {
              console.error("Voice prompt failed:", e.message);
            }
          }

          // --- Step 2: Generation Logic (TTS + LipSync vs Image2Video) ---
          let videoUrl = "";
          let videoId = "";
          let currentDuration = 5;

          if (voiceId) {
            // Dedicated TTS + LipSync Flow
            send({ type: "progress", status: "voice", message: "🎙️ Generating premium audio via Kling TTS..." });
            const ttsResult = await kling.text2speech(script, voiceId);
            const audioUrl = await kling.pollTask(ttsResult.task_id);

            send({ type: "progress", status: "lipsync", message: "🎬 Animating avatar with lip-sync..." });
            const lipsyncResult = await kling.lipsync(base64Image, audioUrl);
            videoUrl = await kling.pollTask(lipsyncResult.task_id);
            videoId = lipsyncResult.task_id;
            currentDuration = targetDuration; // Assume lipsync matches audio duration
          } else {
            // Standard Image2Video Flow
            send({ type: "progress", status: "generating", message: "🎬 Generating cinematic base clip (Kling Pro)..." });
            
            const basePrompt = buildKlingPrompt(script, voicePrompt, gestureStyle, propertyDetails);
            const baseResult = await kling.image2video({
              prompt: basePrompt,
              image: base64Image,
              mode: "pro",
              duration: "5", 
              aspect_ratio: "9:16"
            });

            const taskId = baseResult.task_id;
            send({ type: "progress", status: "polling", message: "⏳ Rendering initial scene..." });
            
            videoUrl = await kling.pollTask(taskId);
            videoId = baseResult.task_id; 

            // --- Step 3: Extensions (only for Image2Video) ---
            while (currentDuration < targetDuration) {
              send({ type: "progress", status: "extending", message: `📽️ Extending video... current length: ${currentDuration}s` });
              
              const extResult = await kling.extendVideo(videoId, basePrompt, "5");
              videoUrl = await kling.pollTask(extResult.task_id);
              videoId = extResult.task_id;
              currentDuration += 5;
            }
          }

          // --- Finalize ---
          send({
            type: "video_ready",
            videoUrl: videoUrl,
            isLast: true,
          });

          // Save to DB
          await dbConnect();
          await Asset.create({
            userId,
            name: `Kling Real Estate - ${new Date().toLocaleDateString()}`,
            url: videoUrl,
            type: "clip",
            metadata: { source: "kling", context: "real-estate", duration: currentDuration }
          });

          send({ type: "done", totalVideos: 1 });
          controller.close();
        } catch (err) {
          console.error("Kling Pipeline Error:", err);
          send({ type: "error", message: err.message });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildKlingPrompt(script, voicePrompt, gestureStyle, propertyDetails) {
  let context = "";
  if (propertyDetails) {
    try {
      const details = JSON.parse(propertyDetails);
      context = `Context: ${details.propertyType} in ${details.location}. `;
    } catch {}
  }
  return `${context}Real estate presenter video. ${gestureStyle} gestures. Script: "${script}". Voice: ${voicePrompt}. High fidelity, natural skin texture, consistent lighting.`;
}

async function generateVoicePromptInternal(ai, compositeInlineData, script, propertyDetails) {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use stable version
  let detailsText = "";
  if (propertyDetails) detailsText = ` Property Details: ${propertyDetails}`;
  
  const prompt = `Analyze this property image and script: "${script}".${detailsText}
  Generate a detailed description (max 50 words) of the ideal presenter's voice (tone, accent, energy level) to match the luxury and vibe of this specific property. 
  Focus on making it sound realistic and engaging for real estate.`;
  
  const result = await model.generateContent([{ text: prompt }, { inlineData: compositeInlineData }]);
  return result.response.text();
}
