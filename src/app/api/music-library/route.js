import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, BUCKET, getAssetUrl } from "@/lib/r2";

const PREFIX = "Music/";
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);

function nameFromKey(key) {
  const base = key.slice(key.lastIndexOf("/") + 1);
  const noExt = base.slice(0, base.lastIndexOf("."));
  const cleaned = noExt
    .replace(/-no-copyright(-music)?-?\d*$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const title = (cleaned || noExt).replace(/\b\w/g, (c) => c.toUpperCase());
  return title || base;
}

export const revalidate = 300; // cache listing for 5 minutes

export async function GET() {
  try {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
    );

    const objects = list.Contents ?? [];

    const tracks = objects.filter((obj) => {
      const ext = obj.Key.slice(obj.Key.lastIndexOf(".")).toLowerCase();
      return AUDIO_EXTS.has(ext);
    });

    const urls = await Promise.all(
      tracks.map(async (obj) => {
        const url = await getAssetUrl(obj.Key);
        return { key: obj.Key, name: nameFromKey(obj.Key), url };
      })
    );

    return NextResponse.json({ tracks: urls });
  } catch (err) {
    console.error("[music-library] list error:", err);
    return NextResponse.json({ tracks: [] });
  }
}
