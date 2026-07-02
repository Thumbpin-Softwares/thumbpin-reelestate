import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") || "video.mp4";

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "video/mp4";
  const contentLength = res.headers.get("content-length");

  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${name}"`,
  };
  if (contentLength) headers["Content-Length"] = contentLength;

  return new NextResponse(res.body, { headers });
}
