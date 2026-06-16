import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, BUCKET, getAssetUrl } from "@/lib/r2";

const PREFIX = "web-assets/";
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

export const revalidate = 300; // cache listing for 5 minutes

export async function GET() {
  try {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
    );

    const objects = list.Contents ?? [];

    const videos = objects.filter((obj) => {
      const ext = obj.Key.slice(obj.Key.lastIndexOf(".")).toLowerCase();
      return VIDEO_EXTS.has(ext);
    });

    const urls = await Promise.all(
      videos.map(async (obj) => {
        const url = await getAssetUrl(obj.Key);
        return { key: obj.Key, url };
      })
    );

    return NextResponse.json({ videos: urls });
  } catch (err) {
    console.error("[web-assets] list error:", err);
    return NextResponse.json({ videos: [] });
  }
}
