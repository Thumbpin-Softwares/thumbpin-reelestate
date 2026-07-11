import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getResolvedUserId } from "@/lib/user-resolver";
import { getTemplateBySlug } from "@/lib/templates";
import { runVideoAdPipeline } from "@/lib/template-generators/run-pipeline";

// One route for every template's Phase 4/5 — the in-scene-presenter,
// asset-anchored pipeline: animate each frame with Veo 3.1 using THAT
// frame's own avatar_url as the starting image (native synchronized
// dialogue/audio generated directly from the prompt — no separate TTS or
// lip-sync-merge call needed), then merge every frame into one master MP4.
// `frames` here already carry `imageUrl`/`avatar_url`/`reference_image_url`
// from the earlier Phase 3 call StepFinalize makes, so runVideoAdPipeline's
// Phase 3 step is a no-op for this route (no duplicate image billing).
// `gender` is a UI-provided flag (picked in Add Assets), never guessed
// server-side. Subject to TEST_MODE_LIMIT in run-pipeline.js while
// presenter/dialogue quality is being tuned.
export async function POST(request, { params }) {
  const { slug } = await params;

  const template = getTemplateBySlug(slug);
  if (!template) {
    return NextResponse.json({ error: `Unknown template "${slug}"` }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const frames = body.frames;
  if (!Array.isArray(frames) || frames.length === 0) {
    return NextResponse.json({ error: "frames must be a non-empty array" }, { status: 400 });
  }

  const gender = body.gender;
  if (!gender) {
    return NextResponse.json({ error: "gender is required" }, { status: 400 });
  }

  try {
    const userId = await getResolvedUserId(request);
    const { clips, finalVideoUrl } = await runVideoAdPipeline(frames, {
      userId: userId || "template",
      gender,
    });
    return NextResponse.json({ success: true, clips, finalVideoUrl });
  } catch (err) {
    console.error(`[api/template/generate-videos/${slug}] failed:`, err);
    return NextResponse.json({ error: err.message || "Video generation failed" }, { status: 500 });
  }
}
