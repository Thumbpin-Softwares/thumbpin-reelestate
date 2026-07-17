import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /model-tour/generations.
export async function GET(request) {
  const { search } = new URL(request.url);
  const { status, data } = await authedBackendGet(`/model-tour/generations${search}`);
  return NextResponse.json(data, { status });
}
