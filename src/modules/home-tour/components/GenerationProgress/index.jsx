"use client";

import { compressImage } from "@/utils/compress-image";
import { getVideoDuration, getAudioDuration } from "@/lib/media-duration";
import { clampBrollClips } from "@/lib/remotion/duration";
import { useGenerationPipeline } from "@/modules/common/hooks/use-generation-pipeline";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";

/**
 * GenerationProgress for the Seedance 3-part pipeline (avatar intro + broll
 * walkthrough + CTA), rendered to a final downloadable mp4 (finalizeMode:
 * "render"). home-tour's own generate-pipeline/render-remotion routes still
 * speak this 3-part shape, unlike seedance-reel/action-reel/comedy-reel's
 * newer 2-part "hard cut" shape — so its composition-building differs, but
 * the step-by-step orchestration is shared via useGenerationPipeline.
 */
export function GenerationProgress({
  generationParams,
  onAbort,
  apiBasePath = "/api/seedance-reel",
  source = "seedance-reel",
  editPath = "/app/edit",
  jobIdKey = "seedance_job_id",
  compositionKey = "video_composition",
  resumeKey = "seedance_resume",
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

    /**
     * brollClips shape: Array<{ url, videoDuration, segmentDuration }>
     *   segmentDuration = how long to display the clip (= Part 2 audio duration for 1 clip)
     *   playbackRate is computed inside the composition: min(1, videoDuration / segmentDuration)
     *   so a 12s clip filling a 25s segment plays at 0.48× speed (luxury slow-motion)
     */
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

      // segmentDuration = full Part 2 audio length — the clip will be slowed to fill it
      const videoDuration   = walkthroughVideoDur > 0 ? walkthroughVideoDur : 12;
      const segmentDuration = part2AudioDur > 0 ? part2AudioDur : videoDuration;

      const rawBrollClips = wtUrl
        ? [{ url: wtUrl, videoDuration, segmentDuration }]
        : [];

      // Keep the merged reel at 60s max — the Part 2 voiceover length is the
      // only elastic part, so it's the one that gets compressed if needed.
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
