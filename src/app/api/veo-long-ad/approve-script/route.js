import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pendingJobs } from "@/lib/veo-pending-jobs";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId, chunks, masterVoicePrompt, presenterDescription } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    if (!pendingJobs.has(jobId)) {
      return NextResponse.json({ error: "Job not found or already started" }, { status: 404 });
    }

    pendingJobs.get(jobId).resolve({ chunks, masterVoicePrompt, presenterDescription });
    pendingJobs.delete(jobId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ApproveScript] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
