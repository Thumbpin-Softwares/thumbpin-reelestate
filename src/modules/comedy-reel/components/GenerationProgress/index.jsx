"use client";

import { compressImage } from "@/utils/compress-image";
import { getVideoDuration } from "@/lib/media-duration";
import { COMPOSITION_STORAGE_KEY, EDIT_PATH } from "@/lib/editable-sources";
import { useGenerationPipeline } from "@/modules/common/hooks/use-generation-pipeline";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

/**
 * GenerationProgress for the Comedy Reel pipeline — same 2-video-slot shape
 * as action-reel, reusing the "ActionReel" Remotion composition (comedy-reel's
 * output — two baked-audio clips, hard cut — is identical to action-reel's).
 *
 * Once both Seedance clips are ready, renders them into one final downloadable
 * mp4 (finalizeMode: "render") instead of redirecting straight to the editor.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/comedy-reel",
  source = "comedy-reel",
  jobIdKey = "comedy_reel_job_id",
  resumeKey = "comedy_reel_resume",
}) {
  const state = useGenerationPipeline({
    generationParams,
    onAbort,
    apiBasePath,
    source,
    jobIdKey,
    resumeKey,
    compositionKey: COMPOSITION_STORAGE_KEY,
    editPath: EDIT_PATH,
    finalizeMode: "render",

    jobStatusToStage: {
      running:   "splitting",
      splitting: "splitting",
      voices:    "voices",
      seedance:  "video",
    },

    buildFormData: async (params, jobId) => {
      const {
        script = "",
        voiceId = "21m00Tcm4TlvDq8ikWAM",
        language = "english",
        tone = "luxury",
        locationImages = [],
        avatarUrls = [],
        customVoiceFile = null,
      } = params || {};

      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);
      formData.append("tone", tone);
      if (customVoiceFile) formData.append("customVoiceFile", customVoiceFile);

      avatarUrls.slice(0, 3).forEach((url, i) => formData.append(`avatarUrl_${i}`, url));

      await Promise.all(
        locationImages.slice(0, 4).map(async (img, i) => {
          if (!img.file) return;
          try {
            const compressed = await compressImage(img.file);
            formData.append(`locationImage_${i}`, compressed);
          } catch (_) {
            formData.append(`locationImage_${i}`, img.file);
          }
        })
      );

      return formData;
    },

    stageForEvent: (event) => {
      switch (event.type) {
        case "script_splitting":
        case "script_adapting":
        case "script_split":
          return "splitting";
        case "voice_generating":
          return "voices";
        case "voice_all_ready":
        case "seedance_prompt_ready":
        case "seedance_generating":
          return "video";
        default:
          return null;
      }
    },

    isFatalError: (event) => event.type === "fatal_error",

    toastForEvent: (event) => {
      switch (event.type) {
        case "part1_video_done":
          return { type: "success", message: "Part 1 (hook) video ready!" };
        case "part2_video_done":
          return { type: "success", message: "Part 2 (highlights + CTA) video ready!" };
        case "seedance_error":
          return { type: "warning", message: event.message, options: { duration: 8000 } };
        default:
          return null;
      }
    },

    buildComposition: async (data) => {
      const p1Url = data.part1VideoUrl;
      const p2Url = data.part2VideoUrl;
      if (!p1Url && !p2Url) throw new Error("No videos were generated. Check server logs.");

      const [part1Duration, part2Duration] = await Promise.all([
        getVideoDuration(p1Url),
        getVideoDuration(p2Url),
      ]);

      return {
        source,
        part1VideoUrl: p1Url || "",
        part2VideoUrl: p2Url || "",
        part1Duration: part1Duration > 0 ? part1Duration : 15,
        part2Duration: part2Duration > 0 ? part2Duration : 15,
      };
    },
  });

  return <GenerationProgressShell {...state} />;
}
