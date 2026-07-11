import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getTemplateBySlug } from "@/lib/templates";
import { generateFrameImages } from "@/lib/template-generators/generate-images";

// One route for every template's storyboard → images step, same shape as
// /api/template/generate-script/[slug]. Turning frames into images is a
// generic operation (Nano Banana + 9:16 + resolution/cost settings) that
// doesn't vary per template the way script tone does, so unlike
// generate-script there's no per-slug generator registry here — just the
// shared worker. If a template ever needs a different image pipeline, this
// is where that per-slug branching would get added.
//
// Asset-anchored architecture: each frame in `frames` already carries its
// own `avatar_url`/`reference_image_url` (assigned by generic.js's
// generateScript, resolved to absolute R2 URLs there) — nothing to pass in
// separately here.
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
    const renderedFrames = await generateFrameImages(frames);
    return NextResponse.json({ success: true, frames: renderedFrames });
  } catch (err) {
    console.error(`[api/template/generate-images/${slug}] failed:`, err);
    return NextResponse.json({ error: err.message || "Image generation failed" }, { status: 500 });
  }
}
