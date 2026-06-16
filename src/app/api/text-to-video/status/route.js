import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MODEL_CONFIGS = {
  heygen: {
    envKey: "HEYGEN_API_KEY",
    getStatus: async (videoId, apiKey) => {
      // ... existing code ...
      console.log(`[Status Check] Fetching Heygen status for video ${videoId}...`);
      
      let res = await fetch(`https://api.heygen.com/v2/video/status?video_id=${videoId}`, {
        headers: { "X-Api-Key": apiKey },
      });

      if (res.status === 404) {
        res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
          headers: { "X-Api-Key": apiKey },
        });
      }
      
      const data = await res.json();
      const status = data.data?.status || (data.status === "success" ? "completed" : data.status) || "processing";
      const video_url = data.data?.video_url || data.video_url || null;
      const thumbnail_url = data.data?.thumbnail_url || data.thumbnail_url || null;
      const error = data.error?.message || data.err || null;

      return { status, video_url, thumbnail_url, error };
    },
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    getStatus: async (videoId, apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      const operation = await ai.operations.getVideosOperation({ name: videoId });
      
      let status = operation.done ? "completed" : "processing";
      let video_url = null;
      let thumbnail_url = null;
      let error = null;

      if (operation.done) {
        if (operation.error) {
          error = operation.error.message;
          status = "failed";
        } else {
          const generatedVideo = operation.response?.generatedVideos?.[0]?.video;
          if (generatedVideo) {
            const fileId = generatedVideo.uri.split("/").pop();
            // Using the same walkthrough proxy for consistency
            video_url = `/api/ai-walkthrough/video-proxy?fileId=${fileId}`;
          }
        }
      }

      return { status, video_url, thumbnail_url, error };
    },
  },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("video_id");
  const model = searchParams.get("model")?.toLowerCase();

  if (!videoId || !model) {
    return NextResponse.json({ error: "Missing video_id or model" }, { status: 400 });
  }

  const config = MODEL_CONFIGS[model];
  if (!config) {
    return NextResponse.json({ error: `Status check not implemented for ${model}` }, { status: 501 });
  }

  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const result = await config.getStatus(videoId, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[Status Check] ${model} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
