import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const rawName = searchParams.get("name") || "video";
  const name = rawName.replace(/[^\w.\-]/g, "_") + (rawName.includes(".") ? "" : ".mp4");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error("[download] fetch failed:", err);
    return NextResponse.json({ error: "Failed to reach asset URL" }, { status: 502 });
  }

  if (!res.ok) {
    console.error("[download] upstream error:", res.status, await res.text());
    return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
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
