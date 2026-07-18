import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /comedy-reel/jobs/:jobId.
export async function GET(request, { params }) {
  const { jobId } = await params;
  const { status, data } = await authedBackendGet(`/comedy-reel/jobs/${jobId}`);
  return NextResponse.json(data, { status });
}
