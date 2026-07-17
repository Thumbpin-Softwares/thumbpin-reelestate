import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /model-tour/jobs/:jobId.
export async function GET(request, { params }) {
  const { jobId } = await params;
  const { status, data } = await authedBackendGet(`/model-tour/jobs/${jobId}`);
  return NextResponse.json(data, { status });
}
