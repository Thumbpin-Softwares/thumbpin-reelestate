"use client";

import { compressImage } from "@/utils/compress-image";
import { getVideoDuration, getAudioDuration } from "@/lib/media-duration";
import { clampBrollClips } from "@/lib/remotion/duration";
import { useGenerationPipeline } from "@/modules/common/hooks/use-generation-pipeline";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

/**
 * GenerationProgress drives the Seedance 3-part pipeline (avatar intro +
 * broll walkthrough + CTA) for any route that wants its own independent
 * API/job-tracking — pass apiBasePath/editPath (and the sessionStorage keys)
 * to point it at that route's own endpoints instead of the news-anchor
 * defaults. Once all 3 clips are ready, renders them into one final
 * downloadable mp4 (finalizeMode: "render") instead of redirecting straight
 * to the editor.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/news-anchor",
  source = "news-anchor",
  editPath = "/dashboard/edit",
  jobIdKey = "news_anchor_job_id",
  compositionKey = "video_composition",
  resumeKey = "news_anchor_resume",
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
      } = params || {};

      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("script", script);
      formData.append("voiceId", voiceId);
      formData.append("language", language);
      formData.append("tone", tone);
      formData.append("quality", quality);
      if (voiceSettings) formData.append("voiceSettings", JSON.stringify(voiceSettings));

      avatarUrls.slice(0, 3).forEach((url, i) => formData.append(`avatarUrl_${i}`, url));

      await Promise.all(
        locationImages.slice(0, 10).map(async (img, i) => {
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

    toastForEvent: (event) => {
      switch (event.type) {
        case "seedance_done":
          return { type: "success", message: "Intro avatar video ready!" };
        case "walkthrough_done":
          return { type: "success", message: "Property walkthrough ready!" };
        case "seedance_cta_done":
          return { type: "success", message: "CTA avatar video ready!" };
        case "seedance_error":
          return { type: "warning", message: event.message, options: { duration: 8000 } };
        default:
          return null;
      }
    },

    buildComposition: async (data) => {
      const avUrl = data.avatarVideoUrl;
      const wtUrl = data.walkthroughVideoUrl;
      const ctaUrl = data.ctaVideoUrl;
      const p2Audio = data.part2AudioUrl;
      if (![avUrl, wtUrl, ctaUrl].some(Boolean)) {
        throw new Error("No videos were generated. Check server logs.");
      }

      const [avatarDur, walkthroughVideoDur, ctaDur, part2AudioDur] = await Promise.all([
        getVideoDuration(avUrl),
        getVideoDuration(wtUrl),
        getVideoDuration(ctaUrl),
        getAudioDuration(p2Audio),
      ]);

      const avatarDuration = avatarDur > 0 ? avatarDur : 15;
      const ctaDuration    = ctaDur > 0 ? ctaDur : 10;

      const videoDuration   = walkthroughVideoDur > 0 ? walkthroughVideoDur : 12;
      const segmentDuration = part2AudioDur > 0 ? part2AudioDur : videoDuration;

      const rawBrollClips = wtUrl
        ? [{ url: wtUrl, videoDuration, segmentDuration }]
        : [];

      const brollClips = clampBrollClips({ avatarDuration, brollClips: rawBrollClips, ctaDuration });

      return {
        source,
        avatarVideoUrl: avUrl  || "",
        brollClips,
        ctaVideoUrl:    ctaUrl || "",
        part2AudioUrl:  p2Audio || "",
        avatarDuration,
        ctaDuration,
        ctaText: data.part3Cta || "",
      };
    },
  });

  return <GenerationProgressShell {...state} />;
}
