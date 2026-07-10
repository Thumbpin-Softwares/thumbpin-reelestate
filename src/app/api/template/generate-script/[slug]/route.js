import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getTemplateBySlug } from "@/lib/templates";
import { getScriptGenerator } from "@/lib/template-generators";

// One route for every template's script generation. The slug picks which
// generator module runs (src/lib/template-generators) — the route itself
// never needs to change as templates #4 through #100 get their own
// generation logic; only the registry in template-generators/index.js does.
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

  try {
    const generateScript = await getScriptGenerator(slug);
    const result = await generateScript({ template, values: body.values || {}, session });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error(`[api/template/generate-script/${slug}] failed:`, err);
    return NextResponse.json({ error: err.message || "Script generation failed" }, { status: 500 });
  }
}
