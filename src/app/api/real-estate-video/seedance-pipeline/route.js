import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";

/**
 * POST /api/real-estate-video/seedance-pipeline
 *
 * Seedance 1.5 Pro (via fal.ai) image-to-video pipeline.
 * Accepts FormData:
 *   compositeImage  File    — the avatar+property composite
 *   script          string  — cinematic Veo-style director's brief (fullScript from generate-script)
 *   voicePrompt     string  — shared voice description for consistent delivery
 *   language        string  — spoken language (default: english)
 *   duration        string  — clip duration in seconds (user-chosen, e.g., 8, 10, 15; default: 8)
 *   resolution      string  — 480p | 720p | 1080p (default: 720p)
 *   generateAudio   string  — "true" | "false" (default: true)
 *
 * Streams SSE: progress → video_ready → done | error
 */

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(request) {
  let userId = null;
  let debit = null;

  const encoder = new TextEncoder();

  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY is not configured" }, { status: 500 });
    }

    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "User not found. Please sign out and sign in again." }, { status: 404 });
    }
    userId = user._id.toString();

    const formData = await request.formData();
    const compositeFile  = formData.get("compositeImage");
    const script         = (formData.get("script") || "").trim();
    const voicePrompt    = (formData.get("voicePrompt") || "").trim();
    const language       = formData.get("language") || "english";
    const durationRaw    = formData.get("duration");
    const duration       = parseFloat(durationRaw) || 8;
    const resolution     = formData.get("resolution") || "720p";
    const generateAudio  = formData.get("generateAudio") !== "false"; // default true

    if (!compositeFile || !script) {
      return NextResponse.json({ error: "compositeImage and script are required" }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/real-estate-video/seedance-pipeline", engine: "seedance" },
    });

    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          // ── Step 1: Upload composite to fal.ai storage ──────────────────
          send({ type: "progress", status: "uploading", message: "☁️ Uploading reference image to Seedance..." });

          const arrayBuffer = await compositeFile.arrayBuffer();
          const imageBlob = new Blob([arrayBuffer], { type: compositeFile.type || "image/jpeg" });
          const imageFile = new File([imageBlob], compositeFile.name || "composite.jpg", {
            type: compositeFile.type || "image/jpeg",
          });

          const falImageUrl = await fal.storage.upload(imageFile);
          console.log("[Seedance] Uploaded composite to fal.ai:", falImageUrl);

          // ── Step 2: Build master prompt ─────────────────────────────────
          // Combine the cinematic director's brief + voice description for richer guidance
          const LANG_MAP = {
            english: "Indian-English", hindi: "natural Hindi", hinglish: "Hinglish (Hindi+English mix)",
            marathi: "fluent Marathi", tamil: "fluent Tamil", telugu: "fluent Telugu",
            kannada: "fluent Kannada", malayalam: "fluent Malayalam", bengali: "fluent Bengali",
            gujarati: "fluent Gujarati", punjabi: "fluent Punjabi", urdu: "fluent Urdu", odia: "fluent Odia",
          };
          const langLabel = LANG_MAP[language] || "Indian-English";

          const voiceLine = voicePrompt
            ? `\nVOICE & DELIVERY: ${voicePrompt}`
            : "\nVOICE: Confident, warm, professional real estate presenter.";

          const masterPrompt = `Real estate property showcase video, 9:16 portrait.
${script}

NOTE: ALL SPOKEN CONTENT MUST FIT WITHIN ${duration} SECONDS TOTAL. Keep spoken lines concise and mapped to camera beats. Do NOT exceed ${duration} seconds of spoken audio.

${voiceLine}
Language: Presenter speaks in ${langLabel}.
AUDIO: Single presenter voice only — no background music, SFX, or ambient noise unless explicitly requested in user intent.
VIDEO: No text, captions, overlays, watermarks, or graphics on screen. Exactly match the person and property in the reference image.
Camera: Medium-to-wide framing, slow elegant movement — property is the star.`;

          console.log("[Seedance] Submitting to fal.ai | duration:", duration, "| resolution:", resolution);

          // ── Step 3: Submit to Seedance via fal.subscribe ────────────────
          send({ type: "progress", status: "generating", message: `🎬 Seedance is rendering your ${duration}s clip...` });

          const result = await fal.subscribe("fal-ai/bytedance/seedance/v1.5/pro/image-to-video", {
            input: {
              prompt:          masterPrompt,
              image_url:       falImageUrl,
              aspect_ratio:    "9:16",
              resolution,
              duration,
              generate_audio:  generateAudio,
              enable_safety_checker: true,
            },
            logs: true,
            onQueueUpdate: (update) => {
              if (update.status === "IN_QUEUE") {
                send({ type: "progress", status: "queued", message: "⏳ Queued in Seedance... waiting to render." });
              }
              if (update.status === "IN_PROGRESS") {
                const logMsg = update.logs?.map((l) => l.message).join(" | ");
                send({ type: "progress", status: "rendering", message: `🔄 Rendering... ${logMsg || ""}`.trim() });
              }
            },
          });

          const falVideoUrl = result?.data?.video?.url;
          if (!falVideoUrl) {
            throw new Error("Seedance returned no video URL. The prompt may have been rejected by the safety checker.");
          }

          console.log("[Seedance] Video ready from fal.ai:", falVideoUrl);

          // ── Step 4: Download and upload to R2 ───────────────────────────
          let finalVideoUrl = falVideoUrl;
          try {
            send({ type: "progress", status: "saving", message: "☁️ Saving video to your cloud storage..." });

            const videoResponse = await fetch(falVideoUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const key = buildUserKey(userId, "videos", "mp4", "seedance");
            finalVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
            console.log(`[Seedance] Uploaded to R2: ${key} (${(videoBytes.length / 1024 / 1024).toFixed(1)} MB)`);
          } catch (saveErr) {
            console.error("[Seedance] R2 upload failed, using fal.ai URL:", saveErr.message);
          }

          send({ type: "video_ready", videoUrl: finalVideoUrl, isLast: true });

          // ── Step 5: Save to Asset Library ───────────────────────────────
          try {
            await dbConnect();
            await Asset.create({
              userId,
              name: `Seedance Video - ${new Date().toLocaleDateString()}`,
              url: finalVideoUrl,
              type: "clip",
              metadata: {
                source: "seedance",
                engine: "fal-ai/bytedance/seedance/v1.5/pro",
                duration,
                resolution,
                context: "real-estate-video",
                seed: result?.data?.seed,
              },
            });
          } catch (dbErr) {
            console.error("[Seedance] DB Error:", dbErr);
          }

          send({ type: "done", totalVideos: 1 });
          controller.close();

        } catch (err) {
          console.error("[Seedance] Pipeline error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: {
                endpoint: "/api/real-estate-video/seedance-pipeline",
                reason: "generation_failed",
                message: err.message,
              },
            });
          }

          send({ type: "error", message: err.message || "Seedance generation failed" });
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
    console.error("[Seedance] Route error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: { endpoint: "/api/real-estate-video/seedance-pipeline", reason: "unexpected_error", message: error.message },
      });
    }

    return NextResponse.json({ error: error.message || "Failed to start Seedance generation" }, { status: 500 });
  }
}
