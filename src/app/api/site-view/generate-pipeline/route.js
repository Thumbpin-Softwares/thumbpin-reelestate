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
 * POST /api/site-view/generate-pipeline
 *
 * Core SSE pipeline for site-visit videos:
 * 1. Emit script_requires_approval — user can edit chunks for 10s before auto-approve
 * 2. Generate first 8s clip (Veo 3.1 generateVideos with site + avatar reference images)
 * 3. For each subsequent chunk, extend using Veo 3.1 extend (video: { uri })
 * 4. Upload final video to R2 and save to Asset Library
 *
 * Input (FormData):
 *   chunks: JSON string (array of chunk objects from /site-view/chunk-script)
 *   masterVoicePrompt: string
 *   presenterDescription: string
 *   siteImages[]: File[]
 *   avatarImages[]: File[]
 *   language: string
 *   aspectRatio: "9:16" | "16:9"
 *
 * SSE events: (identical shape to veo-long-ad for client compatibility)
 *   { type: "script_requires_approval", jobId, chunks, masterVoicePrompt, presenterDescription, message }
 *   { type: "script_approved", message }
 *   { type: "progress", chunkIndex, totalChunks, status, message }
 *   { type: "chunk_done", chunkIndex, totalChunks, estimatedDuration, clipUrl, message }
 *   { type: "uploading", message }
 *   { type: "video_ready", videoUrl, totalChunks, totalDuration }
 *   { type: "error", message, failedChunkIndex? }
 *   { type: "done" }
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

    // Collect site images (used as STYLE references — outdoor environment)
    const siteImages = [];
    for (let i = 0; i < 10; i++) {
      const file = formData.get(`siteImage_${i}`);
      if (file) siteImages.push(file);
    }
    if (siteImages.length === 0) {
      const single = formData.get("siteImage");
      if (single) siteImages.push(single);
    }

    // Also accept locationImage_ keys for backward compat from the client
    if (siteImages.length === 0) {
      for (let i = 0; i < 10; i++) {
        const file = formData.get(`locationImage_${i}`);
        if (file) siteImages.push(file);
      }
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
      metadata: { endpoint: "/api/site-view/generate-pipeline" },
    });
    if (!creditResult.ok) {
      return NextResponse.json(creditResult.payload, { status: creditResult.status });
    }
    debit = creditResult.debit;

    async function fileToBase64(file) {
      const buf = Buffer.from(await file.arrayBuffer());
      return {
        imageBytes: buf.toString("base64"),
        mimeType: file.type || "image/jpeg",
      };
    }

    const avatarImgs = [];
    for (const f of avatarImages.slice(0, 2)) {
      try { avatarImgs.push(await fileToBase64(f)); } catch (_) {}
    }

    const siteImgs = [];
    for (const f of siteImages.slice(0, 2)) {
      try { siteImgs.push(await fileToBase64(f)); } catch (_) {}
    }

    const maxSlots = 3;
    const avatarSlots = Math.min(avatarImgs.length, maxSlots - 1);
    const siteSlots = Math.min(siteImgs.length, maxSlots - avatarSlots);
    console.log(`[SiteView] avatarSlots: ${avatarSlots}, siteSlots: ${siteSlots}`);

    const referenceImages = [
      ...avatarImgs.slice(0, avatarSlots).map((img) => ({
        image: img,
        referenceType: "SUBJECT",
      })),
      ...siteImgs.slice(0, siteSlots).map((img) => ({
        image: img,
        referenceType: "STYLE",
      })),
    ];
    console.log(`[SiteView] Total referenceImages: ${referenceImages.length}`);

    const avatarReferenceImages = avatarImgs.slice(0, avatarSlots).map((img) => ({
      image: img,
      referenceType: "SUBJECT",
    }));

    // ── SSE stream ──────────────────────────────────────────────────────────
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
            send({ type: "ping" });

            const nextOp = await ai.operations.getVideosOperation({ operation: currentOp });
            if (!nextOp) {
              console.warn("[SiteView] Poll returned null, retrying...");
              continue;
            }
            currentOp = nextOp;
          }

          if (!currentOp) throw new Error("Operation lost during polling");
          if (currentOp.error) {
            const rawMsg = currentOp.error.message || "";
            const lc = rawMsg.toLowerCase();
            const isVeoTransient =
              lc.includes("internal server") ||
              lc.includes("internal_server") ||
              lc.includes("transient") ||
              lc.includes("unavailable") ||
              lc.includes("resource_exhausted") ||
              lc.includes("resource exhausted") ||
              lc.includes("503") ||
              lc.includes("429");
            throw new Error(isVeoTransient
              ? `Veo transient error — ${rawMsg}`
              : rawMsg || "Operation failed");
          }

          console.log("[SiteView] Operation done. Keys:", currentOp ? Object.keys(currentOp) : "null");
          const resp = currentOp.response ?? currentOp;
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

          console.warn("[SiteView] extractGeneratedVideo: no video found. keys:", Object.keys(result));
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

        let workChunks = [...chunks];
        let workVoicePrompt = masterVoicePrompt;
        let workPresenterDesc = presenterDescription;

        try {
          // ── Script Approval ─────────────────────────────────────────────
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

          // ── Step 1: Generate first 8s clip ──────────────────────────────
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

          const firstPrompt = buildFirstClipPrompt(chunk0);

          let firstGeneratedVideo = null;
          let rawVideoUri = null;

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (attempt > 0) {
                const waitSec = 30 * attempt;
                send({
                  type: "progress",
                  chunkIndex: 0,
                  totalChunks,
                  status: "generating",
                  message: `⚠️ Veo transient error — retrying base clip in ${waitSec}s (attempt ${attempt + 1}/3)...`,
                });
                await new Promise((r) => setTimeout(r, waitSec * 1000));
              }

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

              send({
                type: "progress",
                chunkIndex: 0,
                totalChunks,
                status: "rendering",
                message: attempt > 0
                  ? `⏳ Rendering base clip (retry ${attempt + 1}/3)...`
                  : "⏳ Rendering base clip... usually takes 2–3 minutes.",
              });

              const firstResult = await pollOperation(genOp);
              firstGeneratedVideo = extractGeneratedVideo(firstResult);
              rawVideoUri = extractVideoUri(firstGeneratedVideo);
              break;
            } catch (err) {
              const msg = (err.message || "").toLowerCase();
              const isTransient =
                msg.includes("internal server") ||
                msg.includes("internal_server") ||
                msg.includes("transient") ||
                msg.includes("unavailable") ||
                msg.includes("resource_exhausted") ||
                msg.includes("timeout") ||
                msg.includes("429") ||
                msg.includes("503");
              if (!isTransient || attempt === 2) throw err;
            }
          }

          if (!rawVideoUri) {
            throw new Error("Base video generation returned no video. The prompt may have been rejected or Veo returned an unexpected response shape.");
          }
          currentVideoUri = cleanVeoUri(rawVideoUri);
          console.log("[SiteView] Base clip URI:", currentVideoUri);

          const baseClipFileId = extractFileId(currentVideoUri);
          send({
            type: "chunk_done",
            chunkIndex: 0,
            totalChunks,
            estimatedDuration: chunk0.estimatedSeconds || 8,
            clipUrl: baseClipFileId ? `/api/ai-walkthrough/video-proxy?fileId=${baseClipFileId}` : null,
            message: `✅ Base clip ready (${chunk0.estimatedSeconds || 8}s)`,
          });

          // ── Step 2: Extend for each subsequent chunk ─────────────────────
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

            if (i > 1) {
              await new Promise((r) => setTimeout(r, 8000));
            }

            send({
              type: "progress",
              chunkIndex: i,
              totalChunks,
              status: "extending",
              message: `🔄 Extending with chunk ${i + 1}/${totalChunks} (~${cumulativeDuration}s so far)...`,
            });

            const extensionPrompt = buildExtensionPrompt(chunk);

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

                break;
              } catch (err) {
                lastErr = err;
                const msg = (err.message || "").toLowerCase();
                const isTransient =
                  msg.includes("internal server") ||
                  msg.includes("internal_server") ||
                  msg.includes("transient") ||
                  msg.includes("unavailable") ||
                  msg.includes("resource_exhausted") ||
                  msg.includes("timeout") ||
                  msg.includes("429") ||
                  msg.includes("503") ||
                  msg.includes("not processed");

                if (!isTransient) throw err;
                if (attempt === 2) break;

                const delay = msg.includes("not processed") ? 30000 * (attempt + 1) : 90000;
                send({
                  type: "progress",
                  chunkIndex: i,
                  totalChunks,
                  status: "extending",
                  message: `⚠️ Veo transient error — retrying chunk ${i + 1} in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/3)...`,
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

          // ── Step 3: Download + upload to R2 ────────────────────────────
          const finalFileId = extractFileId(currentVideoUri);
          if (!finalFileId) throw new Error("Failed to extract final fileId");

          send({ type: "uploading", message: "☁️ Saving final video to cloud storage..." });

          let finalVideoUrl = `/api/ai-walkthrough/video-proxy?fileId=${finalFileId}`;

          try {
            const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${finalFileId}?key=${apiKey}&alt=media`;
            const videoResponse = await fetch(downloadUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBytes = Buffer.from(await videoResponse.arrayBuffer());

            const key = buildUserKey(userId, "videos", "mp4", "site-view");
            finalVideoUrl = await uploadToR2(videoBytes, key, "video/mp4");
          } catch (saveErr) {
            console.error("[SiteView] R2 upload failed, using proxy URL:", saveErr.message);
          }

          // ── Save to Asset Library ──────────────────────────────────────
          try {
            await dbConnect();
            await Asset.create({
              userId,
              name: `Site Visit Video — ${new Date().toLocaleDateString()}`,
              url: finalVideoUrl,
              type: "clip",
              metadata: {
                fileId: finalFileId,
                videoUri: currentVideoUri,
                source: "site-view",
                totalChunks,
                totalDuration: workChunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0),
                context: "site-view",
              },
            });
          } catch (dbErr) {
            console.error("[SiteView] DB save error:", dbErr);
          }

          const totalDuration = workChunks.reduce((s, c) => s + (c.estimatedSeconds || 8), 0);

          send({
            type: "video_ready",
            videoUrl: finalVideoUrl,
            totalChunks,
            totalDuration,
            message: `🎉 Your ${totalDuration}s site-visit video is ready!`,
          });

          send({ type: "done" });
          controller.close();
        } catch (err) {
          console.error("[SiteView] Pipeline error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: {
                endpoint: "/api/site-view/generate-pipeline",
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
    console.error("[SiteView] Outer error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: {
          endpoint: "/api/site-view/generate-pipeline",
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

function buildFirstClipPrompt(chunk) {
  return chunk.veoPrompt || "Outdoor real estate site-visit video. Presenter standing at development site entrance, open land behind them. Match SUBJECT reference image exactly for the presenter. Natural daylight, authentic on-site energy.";
}

function buildExtensionPrompt(chunk) {
  return chunk.veoPrompt || "Continue the site-visit video. MAINTAIN EXACT SAME PRESENTER IDENTITY AND OUTFIT. Seamless continuation from the last frame. Outdoor development site setting.";
}
