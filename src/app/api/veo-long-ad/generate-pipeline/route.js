export const maxDuration = 300;

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import Asset from "@/models/Asset";
import dbConnect from "@/lib/mongodb";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import { pendingJobs } from "@/lib/veo-pending-jobs";

/**
 * POST /api/veo-long-ad/generate-pipeline
 *
 * Core SSE pipeline:
 * 1. Emit script_requires_approval — user can edit chunks for 10s before auto-approve
 * 2. Generate first 8s clip (Veo 3.1 generateVideos with reference images)
 * 3. For each subsequent chunk, extend using Veo 3.1 extend (video: { uri })
 * 4. Upload final video to R2 and save to Asset Library
 *
 * Input (FormData):
 * chunks: JSON string (array of chunk objects from /chunk-script)
 * masterVoicePrompt: string
 * presenterDescription: string
 * locationImages[]: File[]
 * avatarImages[]: File[]
 * language: string
 * aspectRatio: "9:16" | "16:9"
 *
 * SSE events:
 * { type: "script_requires_approval", jobId, chunks, masterVoicePrompt, presenterDescription, message }
 * { type: "script_approved", message }
 * { type: "progress", chunkIndex, totalChunks, status, message }
 * { type: "chunk_done", chunkIndex, totalChunks, estimatedDuration, clipUrl, message }
 * { type: "uploading", message }
 * { type: "video_ready", videoUrl, totalChunks, totalDuration }
 * { type: "error", message, failedChunkIndex? }
 * { type: "done" }
 */
export async function POST(request) {
  let userId = null;
  let debit = null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = session.user.id;

    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    userId = user._id.toString();

    const formData = await request.formData();

    const chunksRaw = formData.get("chunks");
    if (!chunksRaw) {
      return NextResponse.json({ error: "chunks is required" }, { status: 400 });
    }
    let chunks;
    try {
      chunks = JSON.parse(chunksRaw);
    } catch {
      return NextResponse.json({ error: "Invalid chunks JSON" }, { status: 400 });
    }
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json({ error: "At least 1 chunk required" }, { status: 400 });
    }
    if (chunks.length > 5) {
      return NextResponse.json({ error: "Maximum 5 chunks allowed" }, { status: 400 });
    }

    const masterVoicePrompt = (formData.get("masterVoicePrompt") || "").toString();
    const presenterDescription = (formData.get("presenterDescription") || "").toString();
    const language = (formData.get("language") || "english").toString();
    const aspectRatio = (formData.get("aspectRatio") || "9:16").toString();

    // Collect location images (for first video reference)
    const locationImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`locationImage_${i}`);
      if (file) locationImages.push(file);
    }
    if (locationImages.length === 0) {
      const single = formData.get("locationImage");
      if (single) locationImages.push(single);
    }

    // Collect avatar images
    const avatarImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`avatarImage_${i}`);
      if (file) avatarImages.push(file);
    }
    if (avatarImages.length === 0) {
      const single = formData.get("avatarImage");
      if (single) avatarImages.push(single);
    }

    // Debit credits
    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/veo-long-ad/generate-pipeline" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    // Build reference images for first clip
    async function fileToBase64(file) {
      const buf = Buffer.from(await file.arrayBuffer());
      return {
        imageBytes: buf.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const avatarImgs = [];
    for (const f of avatarImages.slice(0, 2)) {
      try {
        avatarImgs.push(await fileToBase64(f));
      } catch (_) {}
    }

    const locationImgs = [];
    for (const f of locationImages.slice(0, 2)) {
      try {
        locationImgs.push(await fileToBase64(f));
      } catch (_) {}
    }

    const maxSlots = 3;
    const avatarSlots = Math.min(avatarImgs.length, maxSlots - 1);
    const locationSlots = Math.min(locationImgs.length, maxSlots - avatarSlots);
    console.log(`[VeoLongAd] avatarSlots: ${avatarSlots}, locationSlots: ${locationSlots}`);

    const referenceImages = [
      ...avatarImgs.slice(0, avatarSlots).map((img) => ({
        image: img,
        referenceType: "SUBJECT",
      })),
      ...locationImgs.slice(0, locationSlots).map((img) => ({
        image: img,
        referenceType: "STYLE",
      })),
    ];
    console.log(`[VeoLongAd] Total referenceImages: ${referenceImages.length}`);

    // Avatar-only references reused on every extension to lock outfit/identity
    const avatarReferenceImages = avatarImgs.slice(0, avatarSlots).map((img) => ({
      image: img,
      referenceType: "SUBJECT",
    }));

    // ── SSE stream ────────────────────────────────────────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(data) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (_) {}
        }

        async function pollOperation(initialOperation, timeoutMs = 12 * 60 * 1000) {
          let currentOp = initialOperation;
          const deadline = Date.now() + timeoutMs;

          while (currentOp && !currentOp.done) {
            if (Date.now() > deadline) throw new Error("Video generation timed out");
            await new Promise((r) => setTimeout(r, 10000));
            send({ type: "ping" }); // keep SSE connection alive during long polls

            const nextOp = await ai.operations.getVideosOperation({ operation: currentOp });
            if (!nextOp) {
              console.warn("[VeoLongAd] Poll returned null, retrying...");
              continue;
            }
            currentOp = nextOp;
          }

          if (!currentOp) throw new Error("Operation lost during polling");
          if (currentOp.error) {
            const msg = currentOp.error.message || "";
            throw new Error(msg.includes("internal server issue")
              ? "Gemini encountered a transient error. Please retry in 1–2 minutes."
              : msg || "Operation failed");
          }

          console.log("[VeoLongAd] Operation done. Top-level keys:", currentOp ? Object.keys(currentOp) : "null");
          const resp = currentOp.response ?? currentOp;
          console.log("[VeoLongAd] Response keys:", resp ? Object.keys(resp) : "null");
          try {
            console.log("[VeoLongAd] Response (truncated):", JSON.stringify(resp)?.slice(0, 600));
          } catch (_) {}

          return resp;
        }

        function extractGeneratedVideo(result) {
          if (!result) return null;

          const v0 =
            result?.generatedVideos?.[0]?.video ||
            result?.generatedVideos?.[0]?.videoResponse;
          if (v0) return v0;

          const v1 =
            result?.response?.generatedVideos?.[0]?.video ||
            result?.response?.generatedVideos?.[0]?.videoResponse;
          if (v1) return v1;

          const v2 =
            result?.generateVideoResponse?.generatedSamples?.[0]?.video ||
            result?.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
          if (v2) return v2;

          const v3 = result?.videos?.[0];
          if (v3) return v3;

          const v4 = result?.candidates?.[0]?.content?.parts?.find((p) => p?.fileData?.fileUri)?.fileData;
          if (v4) return v4;

          console.warn("[VeoLongAd] extractGeneratedVideo: no video found. result keys:", Object.keys(result));
          return null;
        }

        function extractVideoUri(videoObj) {
          if (!videoObj) return null;
          return videoObj.uri || videoObj.fileUri || videoObj.videoUri || videoObj.url || null;
        }

        function extractFileId(uri) {
          if (!uri) return null;
          const match = uri.match(/files\/([^/:?]+)/);
          return match?.[1] || null;
        }

        function cleanVeoUri(uri) {
          if (!uri) return uri;
          return uri.replace(/:download.*$/, "").replace(/\?.*$/, "");
        }

        // Working copies — updated after script approval
        let workChunks = [...chunks];
        let workVoicePrompt = masterVoicePrompt;
        let workPresenterDesc = presenterDescription;

        try {
          // ── Script Approval ───────────────────────────────────────────────
          const jobId = Date.now().toString();

          send({
            type: "script_requires_approval",
            jobId,
            message: "Review your script — auto-approving in 10 seconds...",
            chunks: workChunks,
            masterVoicePrompt: workVoicePrompt,
            presenterDescription: workPresenterDesc,
          });

          const pingInterval = setInterval(() => send({ type: "ping" }), 3000);

          const approved = await new Promise((resolve) => {
            pendingJobs.set(jobId, { resolve });
            setTimeout(() => {
              if (pendingJobs.has(jobId)) {
                pendingJobs.get(jobId).resolve({
                  chunks: workChunks,
                  masterVoicePrompt: workVoicePrompt,
                  presenterDescription: workPresenterDesc,
                });
                pendingJobs.delete(jobId);
              }
            }, 10000);
          });

          clearInterval(pingInterval);
          workChunks = approved.chunks;
          workVoicePrompt = approved.masterVoicePrompt;
          workPresenterDesc = approved.presenterDescription;

          send({ type: "script_approved", message: "Script approved! Starting video generation..." });

          // ── Step 1: Generate first 8-second clip ─────────────────────────
          const totalChunks = workChunks.length;
          let currentVideoUri = null;

          const chunk0 = workChunks[0];

          send({
            type: "progress",
            chunkIndex: 0,
            totalChunks,
            status: "generating",
            message: `🎬 Generating base clip (1/${totalChunks}) — this takes 2–3 minutes...`,
          });

          const firstPrompt = buildFirstClipPrompt(chunk0, workVoicePrompt);

          const genOp = await ai.models.generateVideos({
            model: "veo-3.1-generate-preview",
            prompt: firstPrompt,
            config: {
              aspectRatio,
              resolution: "720p",
              durationSeconds: chunk0.estimatedSeconds || 8,
              referenceImages,
            },
          });

          if (!genOp) throw new Error("Failed to start base video generation");

          console.log("[VeoLongAd] genOp keys:", genOp ? Object.keys(genOp) : null);

          send({
            type: "progress",
            chunkIndex: 0,
            totalChunks,
            status: "rendering",
            message: "⏳ Rendering base clip... usually takes 2–3 minutes.",
          });

          const firstResult = await pollOperation(genOp);
          const firstGeneratedVideo = extractGeneratedVideo(firstResult);
          const rawVideoUri = extractVideoUri(firstGeneratedVideo);

          if (!rawVideoUri) {
            throw new Error("Base video generation returned no video. The prompt may have been rejected or Veo returned an unexpected response shape.");
          }
          currentVideoUri = cleanVeoUri(rawVideoUri);
          console.log("[VeoLongAd] Base clip URI (clean for extension):", currentVideoUri);

          const baseClipFileId = extractFileId(currentVideoUri);
          send({
            type: "chunk_done",
            chunkIndex: 0,
            totalChunks,
            estimatedDuration: chunk0.estimatedSeconds || 8,
            clipUrl: baseClipFileId ? `/api/ai-walkthrough/video-proxy?fileId=${baseClipFileId}` : null,
            message: `✅ Base clip ready (${chunk0.estimatedSeconds || 8}s)`,
          });

          // ── Step 2: Extend for each subsequent chunk ──────────────────────
          let cumulativeDuration = chunk0.estimatedSeconds || 8;

          if (workChunks.length > 1) {
            send({
              type: "progress",
              chunkIndex: 0,
              totalChunks,
              status: "extending",
              message: "⏳ Waiting for base clip to be indexed by Veo (15s)...",
            });
            await new Promise((r) => setTimeout(r, 15000));
          }

          for (let i = 1; i < workChunks.length; i++) {
            const chunk = workChunks[i];

            send({
              type: "progress",
              chunkIndex: i,
              totalChunks,
              status: "extending",
              message: `🔄 Extending with chunk ${i + 1}/${totalChunks} (~${cumulativeDuration}s so far)...`,
            });

            const extensionPrompt = buildExtensionPrompt(chunk, workVoicePrompt);

            let extVideoUri = null;
            let lastErr;

            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const extOp = await ai.models.generateVideos({
                  model: "veo-3.1-generate-preview",
                  video: { uri: currentVideoUri },
                  prompt: extensionPrompt,
                  config: {
                    aspectRatio,
                    resolution: "720p",
                    durationSeconds: chunk.estimatedSeconds || 8,
                    ...(avatarReferenceImages.length > 0 && { referenceImages: avatarReferenceImages }),
                  },
                });

                if (!extOp) throw new Error("Failed to start extension operation");

                send({
                  type: "progress",
                  chunkIndex: i,
                  totalChunks,
                  status: "extending",
                  message: `⏳ Rendering extension ${i + 1}/${totalChunks}...`,
                });

                const extResult = await pollOperation(extOp);
                const extVideo = extractGeneratedVideo(extResult);
                const rawExtUri = extractVideoUri(extVideo);
                extVideoUri = cleanVeoUri(rawExtUri);

                if (!extVideoUri) {
                  throw new Error(`Extension chunk ${i + 1} returned no video URI`);
                }

                break; // success
              } catch (err) {
                lastErr = err;
                const msg = (err.message || "").toLowerCase();
                const isTransient =
                  msg.includes("internal server") ||
                  msg.includes("transient") ||
                  msg.includes("timeout") ||
                  msg.includes("429") ||
                  msg.includes("503") ||
                  msg.includes("not processed") ||
                  msg.includes("invalid_argument");

                if (!isTransient || attempt === 2) throw err;

                const delay = msg.includes("not processed") || msg.includes("invalid_argument")
                  ? 30000 * (attempt + 1)
                  : 8000 * (attempt + 1);

                send({
                  type: "progress",
                  chunkIndex: i,
                  totalChunks,
                  status: "extending",
                  message: `⚠️ Temporary error, retrying chunk ${i + 1} in ${delay / 1000}s...`,
                });
                await new Promise((r) => setTimeout(r, delay));
              }
            }

            if (!extVideoUri) {
              send({
                type: "error",
                failedChunkIndex: i,
                message: `Extension stopped at chunk ${i + 1}: ${lastErr?.message || "No video returned"}. Saving partial video (${cumulativeDuration}s).`,
                partial: true,
              });
              break;
            }

            currentVideoUri = extVideoUri;
            cumulativeDuration += chunk.estimatedSeconds || 8;

            const extClipFileId = extractFileId(extVideoUri);
            send({
              type: "chunk_done",
              chunkIndex: i,
              totalChunks,
              estimatedDuration: cumulativeDuration,
              clipUrl: extClipFileId ? `/api/ai-walkthrough/video-proxy?fileId=${extClipFileId}` : null,
              message: `✅ Extended to ~${cumulativeDuration}s (chunk ${i + 1}/${totalChunks} done)`,
            });
          }

          // ── Step 3: Download + upload to R2 ──────────────────────────────
          const finalFileId = extractFileId(currentVideoUri);
          if (!finalFileId) throw new Error("Failed to extract final fileId");

          send({
            type: "uploading",
            message: "☁️ Saving final video to cloud storage...",
          });

          let finalVideoUrl = `/api/ai-walkthrough/video-proxy?fileId=${finalFileId}`;

          try {
            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${finalFileId}?key=${apiKey}&alt=media`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const key = buildUserKey(userId, "videos", "mp4", "veo-long-ad");
            finalVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
          } catch (saveErr) {
            console.error("[VeoLongAd] R2 upload failed, using proxy URL:", saveErr.message);
          }

          // ── Save to Asset Library ─────────────────────────────────────────
          try {
            await dbConnect();
            await Asset.create({
              userId,
              name: `Long-Form Ad — ${new Date().toLocaleDateString()}`,
              url: finalVideoUrl,
              type: "clip",
              metadata: {
                fileId: finalFileId,
                videoUri: currentVideoUri,
                source: "veo-long-ad",
                totalChunks,
                totalDuration: workChunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0),
                context: "veo-long-ad",
              },
            });
          } catch (dbErr) {
            console.error("[VeoLongAd] DB save error:", dbErr);
          }

          const totalDuration = workChunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0);

          send({
            type: "video_ready",
            videoUrl: finalVideoUrl,
            totalChunks,
            totalDuration,
            message: `🎉 Your ${totalDuration}s long-form ad is ready!`,
          });

          send({ type: "done" });
          controller.close();
        } catch (err) {
          console.error("[VeoLongAd] Pipeline error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: {
                endpoint: "/api/veo-long-ad/generate-pipeline",
                reason: "generation_failed",
                message: err.message,
              },
            });
          }

          send({ type: "error", message: err.message || "Pipeline failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[VeoLongAd] Outer error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: {
          endpoint: "/api/veo-long-ad/generate-pipeline",
          reason: "unexpected_error",
          message: error.message,
        },
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to start pipeline" },
      { status: 500 }
    );
  }
}

function buildFirstClipPrompt(chunk, masterVoicePrompt) {
  const voiceSection = masterVoicePrompt ? `${masterVoicePrompt}\n\n` : "";
  return `${voiceSection}${chunk.veoPrompt || "Ultra-realistic luxury real estate UGC video. Presenter at property exterior. PRESENTER: Match SUBJECT reference image exactly."}`;
}

function buildExtensionPrompt(chunk, masterVoicePrompt) {
  const voiceSection = masterVoicePrompt ? `VOICE: ${masterVoicePrompt}\n\n` : "";
  return `${voiceSection}${chunk.veoPrompt || "Continue the real estate video. MAINTAIN EXACT SAME PRESENTER IDENTITY. Seamless continuation from the last frame."}`;
}
