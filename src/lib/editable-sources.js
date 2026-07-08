// Pipelines whose generated videos can be reopened in the unified Remotion
// editor at /dashboard/edit. Each entry maps the Asset's metadata.source to the
// render API and the "back to generator" path for that pipeline.
//
// compositionType selects which Remotion component/duration-calc the Editor
// (modules/edit/layout/editor) uses for preview + render props:
//   "seedance"    — avatarVideoUrl + brollClips + ctaVideoUrl + part2AudioUrl
//                   (SeedanceReelComposition) — news-anchor/home-tour
//   "action-reel" — part1VideoUrl + part2VideoUrl, two flat baked-audio clips
//                   (ActionReelComposition) — action-reel/comedy-reel/luxury-car-exit
export const EDITABLE_SOURCES = {
  "luxury-car-exit": {
    compositionType: "action-reel",
    renderEndpoint: "/api/luxury-car-exit/render-remotion",
    generatorPath: "/dashboard/luxury-car-exit",
    downloadFilename: "luxury-car-exit.mp4",
  },
  // Back-compat: assets generated before the "seedance-reel" pipeline was
  // renamed to "luxury-car-exit" still have this old metadata.source value —
  // keep them editable by pointing at the same (moved) render endpoint.
  "seedance-reel": {
    compositionType: "action-reel",
    renderEndpoint: "/api/luxury-car-exit/render-remotion",
    generatorPath: "/dashboard/luxury-car-exit",
    downloadFilename: "seedance-reel.mp4",
  },
  "news-anchor": {
    compositionType: "seedance",
    renderEndpoint: "/api/news-anchor/render-remotion",
    generatorPath: "/dashboard/news-anchor",
    downloadFilename: "news-anchor.mp4",
  },
  "home-tour": {
    compositionType: "seedance",
    renderEndpoint: "/api/home-tour/render-remotion",
    generatorPath: "/dashboard/home-tour",
    downloadFilename: "home-tour.mp4",
  },
  "action-reel": {
    compositionType: "action-reel",
    renderEndpoint: "/api/action-reel/render-remotion",
    generatorPath: "/dashboard/action-reel",
    downloadFilename: "action-reel.mp4",
  },
  "comedy-reel": {
    compositionType: "action-reel",
    renderEndpoint: "/api/comedy-reel/render-remotion",
    generatorPath: "/dashboard/comedy-reel",
    downloadFilename: "comedy-reel.mp4",
  },
};

export const COMPOSITION_STORAGE_KEY = "video_composition";
export const EDIT_PATH = "/dashboard/edit";

/** Probe video duration via browser <video> element (header only, no full download). */
export async function getVideoDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const video = document.createElement("video");
    video.addEventListener("loadedmetadata", () => {
      resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    });
    video.addEventListener("error", () => resolve(0));
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.src = url;
  });
}

/** Probe audio duration via browser <audio> element (header only, no full download). */
export async function getAudioDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      resolve(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0);
    });
    audio.addEventListener("error", () => resolve(0));
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.src = url;
  });
}

/** Build Remotion composition props from a saved Asset's metadata (best-effort —
 * brollClips timing/ctaText are reconstructed via duration probing, not the
 * exact values used at generation time). */
export async function buildCompositionFromAsset(asset) {
  const source = asset.metadata?.source;
  const sourceConfig = EDITABLE_SOURCES[source];
  if (!sourceConfig) return null;

  if (sourceConfig.compositionType === "action-reel") {
    const { part1VideoUrl, part2VideoUrl } = asset.metadata;
    const [part1Dur, part2Dur] = await Promise.all([
      getVideoDuration(part1VideoUrl),
      getVideoDuration(part2VideoUrl),
    ]);

    return {
      source,
      assetId: asset.id || "",
      name: asset.name || "",
      part1VideoUrl: part1VideoUrl || "",
      part2VideoUrl: part2VideoUrl || "",
      part1Duration: part1Dur > 0 ? part1Dur : 15,
      part2Duration: part2Dur > 0 ? part2Dur : 15,
    };
  }

  const { avatarVideoUrl, walkthroughVideoUrl, ctaVideoUrl, part2AudioUrl } = asset.metadata;

  const [avatarDur, walkthroughDur, ctaDur, part2AudioDur] = await Promise.all([
    getVideoDuration(avatarVideoUrl),
    getVideoDuration(walkthroughVideoUrl),
    getVideoDuration(ctaVideoUrl),
    getAudioDuration(part2AudioUrl),
  ]);

  const { clampBrollClips } = await import("@/lib/remotion/duration");

  const avatarDuration = avatarDur > 0 ? avatarDur : 15;
  const ctaDuration = ctaDur > 0 ? ctaDur : 10;
  const videoDuration = walkthroughDur > 0 ? walkthroughDur : 12;
  const segmentDuration = part2AudioDur > 0 ? part2AudioDur : videoDuration;

  const rawBrollClips = walkthroughVideoUrl
    ? [{ url: walkthroughVideoUrl, videoDuration, segmentDuration }]
    : [];
  const brollClips = clampBrollClips({ avatarDuration, brollClips: rawBrollClips, ctaDuration });

  return {
    source,
    assetId: asset.id || "",
    name: asset.name || "",
    avatarVideoUrl: avatarVideoUrl || "",
    brollClips,
    ctaVideoUrl: ctaVideoUrl || "",
    part2AudioUrl: part2AudioUrl || "",
    avatarDuration,
    ctaDuration,
    ctaText: "",
  };
}
