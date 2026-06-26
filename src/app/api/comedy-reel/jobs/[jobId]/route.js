import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import SeedanceJob from "@/models/SeedanceJob";

/**
 * GET /api/comedy-reel/jobs/:jobId
 *
 * Lets a refreshed/reattached tab resume an in-flight (or finished) pipeline
 * job instead of re-POSTing to /generate-pipeline, which would double-bill
 * credits and double-fire the fal/Seedance calls.
 */
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { jobId } = await params;

  await dbConnect();
  const job = await SeedanceJob.findOne({ jobId, userId: user._id.toString() }).lean();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
