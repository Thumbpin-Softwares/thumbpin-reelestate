"use client";

import { compressImage } from "@/utils/compress-image";
import { getVideoDuration } from "@/lib/media-duration";
import { useGenerationPipeline } from "@/modules/common/hooks/use-generation-pipeline";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

/**
 * GenerationProgress for the Luxury Car Exit pipeline — 2-part master-template
 * architecture (same shape as action-reel/comedy-reel: two ~15s hard-cut
 * Seedance clips, each with its own baked dialogue audio), rendered via the
 * shared "ActionReel" Remotion composition, then rendered to a final
 * downloadable mp4 (finalizeMode: "render").
 *
 * All the actual step-by-step orchestration (splitting → voices → video →
 * combining → rendering → done, resume-by-jobId, abort, retry) lives in
 * useGenerationPipeline — this file only supplies what's different about
 * this template: its form fields and its 2-part composition shape.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/luxury-car-exit",
  source = "luxury-car-exit",
  editPath = "/dashboard/edit",
  jobIdKey = "luxury_car_exit_job_id",
  compositionKey = "video_composition",
  resumeKey = "luxury_car_exit_resume",
}) {
  const state = useGenerationPipeline({
    generationParams,
    onAbort,
    apiBasePath,
    source,
    jobIdKey,
    resumeKey,
    compositionKey,
    editPath,
    finalizeMode: "render",

    jobStatusToStage: {
      running:   "splitting",
      splitting: "splitting",
      voices:    "voices",
      seedance:  "video",
      combining: "combining",
    },

    buildFormData: async (params, jobId) => {
      const {
        script = "",
        voiceId = "21m00Tcm4TlvDq8ikWAM",
        language = "english",
        tone = "luxury",
        voiceSettings = null,
        quality = "auto",
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
      formData.append("quality", quality);
      if (voiceSettings) formData.append("voiceSettings", JSON.stringify(voiceSettings));
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
          return { type: "success", message: "Part 1 (car exit intro) video ready!" };
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
