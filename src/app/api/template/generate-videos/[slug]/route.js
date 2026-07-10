import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getResolvedUserId } from "@/lib/user-resolver";
import { getTemplateBySlug } from "@/lib/templates";
import { runVideoAdPipeline } from "@/lib/template-generators/run-pipeline";

// One route for every template's Phase 4/4.1/4.2/5 — the in-scene-presenter
// pipeline: animate each frame (Veo), synthesize its narration (ElevenLabs
// Turbo), lip-sync the two together (sync-lipsync), then merge every frame
// into one master MP4. `frames` here already carry `imageUrl` from the
// earlier Phase 3 call StepFinalize makes, so runVideoAdPipeline's Phase 3
// step is a no-op for this route (no duplicate image billing). Subject to
// TEST_MODE_LIMIT in run-pipeline.js while lip-sync quality is being tuned.
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

  try {
    const userId = await getResolvedUserId(request);
    const { clips, finalVideoUrl } = await runVideoAdPipeline(frames, {
      userId: userId || "template",
      voiceId: body.voiceId,
    });
    return NextResponse.json({ success: true, clips, finalVideoUrl });
  } catch (err) {
    console.error(`[api/template/generate-videos/${slug}] failed:`, err);
    return NextResponse.json({ error: err.message || "Video generation failed" }, { status: 500 });
  }
}
