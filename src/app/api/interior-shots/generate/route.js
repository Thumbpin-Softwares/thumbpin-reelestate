export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { uploadToR2, buildUserKey } from "@/lib/r2-upload";
import { consumeCreditsForAction, refundCreditsForAction } from "@/lib/credit-system";
import { fal } from "@fal-ai/client";
import sharp from "sharp";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

async function callSeedanceAndUpload(seedanceInput, userId) {
  const result = await fal.subscribe("bytedance/seedance-2.0/fast/reference-to-video", {
    input: seedanceInput,
    logs: false,
  });
  const falVideoUrl = result?.data?.video?.url;
  if (!falVideoUrl) throw new Error("Seedance returned no video URL");
  const res = await fetch(falVideoUrl);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const key = buildUserKey(userId, "videos", "mp4", "interior-shots");
  return uploadToR2(buf, key, "video/mp4");
}

export async function POST(request) {
  let userId = null;
  let debit  = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { resolveUserFromSession } = await import("@/lib/user-resolver");
    const user = await resolveUserFromSession(request);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    userId = user._id.toString();

    const formData = await request.formData();

    // Collect up to 6 interior images
    const imageBufs = [];
    for (let i = 0; i < 6; i++) {
      const f = formData.get(`image_${i}`);
      if (f && typeof f !== "string") {
        try { imageBufs.push(Buffer.from(await f.arrayBuffer())); } catch (_) {}
      }
    }

    if (imageBufs.length < 2) {
      return NextResponse.json({ error: "Upload at least 2 interior images." }, { status: 400 });
    }

    const creditResult = await consumeCreditsForAction({
      userId,
      action: "real_estate_video",
      metadata: { endpoint: "/api/interior-shots/generate" },
    });
    if (!creditResult.ok) return NextResponse.json(creditResult.payload, { status: creditResult.status });
    debit = creditResult.debit;

    // Upload images to R2 (9:16 crop)
    const imageUrls = [];
    await Promise.all(
      imageBufs.map(async (buf, i) => {
        try {
          const cropped = await sharp(buf)
            .resize(1080, 1920, { fit: "cover", position: "centre" })
            .jpeg({ quality: 88 })
            .toBuffer();
          const key = buildUserKey(userId, "images", "jpg", `interior-img-${i}`);
          const url = await uploadToR2(cropped, key, "image/jpeg");
          if (url.startsWith("http")) imageUrls[i] = url;
        } catch (e) {
          console.warn(`[InteriorShots] Failed to upload image ${i}:`, e.message);
        }
      })
    );

    const validUrls = imageUrls.filter(Boolean);
    if (validUrls.length < 2) throw new Error("Failed to upload images to storage.");

    const encoder = new TextEncoder();
    const stream  = new ReadableStream({
      async start(controller) {
        function send(data) {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch (_) {}
        }

        const pingInterval = setInterval(() => send({ type: "ping" }), 3000);

        try {
          send({ type: "generating", message: "Generating your cinematic interior walkthrough…" });

          // Build prompt referencing each uploaded image
          const imageRefs = validUrls.map((_, i) => `@Image${i + 1}`).join(", ");
          const numImages = validUrls.length;

          let prompt =
            `A seamless, continuous 15-second luxury interior architectural walkthrough with absolutely zero hard cuts. `;

          if (numImages >= 1)
            prompt += `The camera begins in the space shown in @Image1, performing a slow, fluid push forward. `;
          if (numImages >= 2)
            prompt += `It flows without any cut into the area in @Image2, panning gently to reveal the ambient features and premium finishes. `;
          if (numImages >= 3)
            prompt += `The camera glides through an archway and reveals the space shown in @Image3, tracking smoothly across the room. `;
          if (numImages >= 4)
            prompt += `Maintaining momentum, it drifts into @Image4, accentuating the spatial layout and luxury design elements. `;
          if (numImages >= 5)
            prompt += `The journey continues into @Image5 with a gentle upward tilt, capturing height and elegance. `;
          if (numImages >= 6)
            prompt += `Finally the camera settles in @Image6 with a slow, cinematic pull-back to reveal the full grandeur of the space. `;

          prompt +=
            `The entire 15-second sequence is one unbroken, fluid motion — hyper-realistic textures, warm consistent interior lighting, ` +
            `soft natural shadows, and cinematic 4K quality. No people. 9:16 vertical format.`;

          const seedanceInput = {
            prompt,
            aspect_ratio: "9:16",
            duration:     "15",
            resolution:   "720p",
            generate_audio: true,
            image_urls:   validUrls,
          };

          send({ type: "seedance_started", message: "Seedance 2.0 is rendering your walkthrough (3–7 min)…" });

          const videoUrl = await callSeedanceAndUpload(seedanceInput, userId);

          send({ type: "done", videoUrl, message: "Your interior walkthrough is ready!" });
          clearInterval(pingInterval);
          controller.close();
        } catch (err) {
          clearInterval(pingInterval);
          console.error("[InteriorShots] Pipeline error:", err);

          if (userId && debit) {
            await refundCreditsForAction({
              userId,
              action: "real_estate_video",
              debit,
              metadata: { endpoint: "/api/interior-shots/generate", reason: "generation_failed" },
            });
          }

          send({ type: "error", message: err.message || "Generation failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[InteriorShots] Outer error:", error);

    if (userId && debit) {
      await refundCreditsForAction({
        userId,
        action: "real_estate_video",
        debit,
        metadata: { endpoint: "/api/interior-shots/generate", reason: "unexpected_error" },
      });
    }

    return NextResponse.json({ error: error.message || "Failed to start generation" }, { status: 500 });
  }
}
